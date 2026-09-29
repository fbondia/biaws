import { loadRequestOptions } from "./options.js";
import { ensureIndexes } from "./indexes.js";
import {
  ensureRequestListRanks,
  nextTopListRank,
  readListRankNeighbor,
  calculateMovedListRank,
} from "./ordering.js";
import { normalizeRequestPayload } from "./normalization.js";
import { normalizeLegacyNotesPayload } from "./notes/normalization.js";
import {
  REQUESTS_COLLECTION,
  JOURNEY_PERIODS_COLLECTION,
  SPECIFICATION_COLLECTION,
  NOTES_COLLECTION,
  TASKS_COLLECTION,
  TASK_NOTES_COLLECTION,
} from "./constants.js";
import { syncJourneyPeriods, readJourneyPeriods } from "./journeys.js";
import { syncSpecification, readSpecifications } from "./specification.js";
import { insertInitialNotes, syncLegacyNotes } from "./legacyMigration.js";
import { readRequestById } from "./queries.js";
import { requestReferenceId, requestFilter } from "./references.js";
import { createHttpError } from "./support.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import {
  knowledgeContextWasProvided,
  resolveKnowledgeContext,
} from "../shared/knowledgeContext.js";
import { assertResourceCollection } from "../resourceCollections/queries.js";

export async function createRequest(payload, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const { request, journeys, specification } = normalizeRequestPayload(payload);
  const context = await resolveKnowledgeContext(db, payload, null, {
    applicationRequired: true,
    authorizationScope: query.authorizationScope,
    create: true,
  });
  request.collectionId = await assertResourceCollection(
    "demands",
    request.collectionId,
    context.workspaceId,
    query,
  );
  const initialNotes = normalizeLegacyNotesPayload(payload.notes);
  const now = new Date();
  const result = await db.collection(REQUESTS_COLLECTION).insertOne({
    ...request,
    ...context,
    listRank: await nextTopListRank(db),
    createdAt: now,
    createdBy: payload.createdBy || "biaws-api",
    updatedAt: now,
    updatedBy: payload.createdBy || "biaws-api",
  });

  await syncJourneyPeriods(db, result.insertedId, journeys, now);
  await syncSpecification(db, result.insertedId, specification, now);
  await insertInitialNotes(db, result.insertedId, initialNotes, now);

  return {
    request: await readRequestById(db, result.insertedId, query),
  };
}

export async function updateRequest(requestIdValue, payload, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const existing = await db
    .collection(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query));

  if (!existing) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }

  const [existingJourneyPeriodsByRequestId, existingSpecificationByRequestId] =
    await Promise.all([
      readJourneyPeriods(db, [requestId]),
      readSpecifications(db, [requestId]),
    ]);
  const existingJourneyPeriods =
    existingJourneyPeriodsByRequestId.get(requestId.toString()) || [];
  const existingSpecification = existingSpecificationByRequestId.get(
    requestId.toString(),
  );
  const { request, journeys, specification } = normalizeRequestPayload(
    {
      ...existing,
      ...payload,
      checklist: payload.checklist ?? existing.checklist,
      journeys: payload.journeys ?? payload.billing ?? existingJourneyPeriods,
      specification: payload.specification ?? existingSpecification,
    },
    existing.status,
  );
  if (knowledgeContextWasProvided(payload)) {
    Object.assign(
      request,
      await resolveKnowledgeContext(db, payload, existing, {
        applicationRequired: true,
        authorizationScope: query.authorizationScope,
      }),
    );
  }
  request.collectionId = await assertResourceCollection(
    "demands",
    request.collectionId,
    request.workspaceId || existing.workspaceId,
    query,
  );
  const now = new Date();

  await db
    .collection(REQUESTS_COLLECTION)
    .updateOne(requestFilter(requestId, query), {
      $set: {
        ...request,
        updatedAt: now,
        updatedBy: payload.updatedBy || "biaws-ui",
      },
      $unset: {
        notes: "",
      },
    });
  await syncJourneyPeriods(db, requestId, journeys, now);
  await syncSpecification(db, requestId, specification, now);
  if (typeof payload.notes === "string") {
    await syncLegacyNotes(
      db,
      requestId,
      normalizeLegacyNotesPayload(payload.notes),
      now,
    );
  }

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function reorderRequest(requestIdValue, payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const existing = await db
    .collection(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query));

  if (!existing) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }

  const previousRank = await readListRankNeighbor(
    db,
    payload.previousRequestId,
    "previousRequestId",
    String(existing.collectionId || ""),
    query,
  );
  const nextRank = await readListRankNeighbor(
    db,
    payload.nextRequestId,
    "nextRequestId",
    String(existing.collectionId || ""),
    query,
  );
  const listRank = calculateMovedListRank(previousRank, nextRank);

  await db
    .collection(REQUESTS_COLLECTION)
    .updateOne(requestFilter(requestId, query), {
      $set: {
        listRank,
      },
    });

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function moveRequestToCollection(
  requestIdValue,
  collectionId,
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const result = await db
    .collection(REQUESTS_COLLECTION)
    .updateOne(requestFilter(requestId, query), {
      $set: {
        collectionId: String(collectionId || ""),
        updatedAt: new Date(),
      },
    });
  if (!result.matchedCount) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }

  return { request: await readRequestById(db, requestId, query) };
}

export async function deleteRequest(requestIdValue, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const deleteResult = await db
    .collection(REQUESTS_COLLECTION)
    .deleteOne(requestFilter(requestId, query));

  if (!deleteResult.deletedCount) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }

  await db.collection(JOURNEY_PERIODS_COLLECTION).deleteMany({ requestId });
  await db.collection(SPECIFICATION_COLLECTION).deleteMany({ requestId });
  await db.collection(NOTES_COLLECTION).deleteMany({ requestId });
  await db.collection(TASKS_COLLECTION).deleteMany({ requestId });
  await db.collection(TASK_NOTES_COLLECTION).deleteMany({ requestId });

  return {
    deleted: true,
    id: requestIdValue,
  };
}
