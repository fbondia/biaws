import type { Db, ObjectId } from "mongodb";
import type { RequestDocument } from "../../types/requests.js";
import type { RepositoryQuery } from "../../types/http.js";
import {
  loadRequestOptions,
  allRequestStatusOptions,
  defaultRequestStatus,
} from "./options.js";
import {
  REQUESTS_COLLECTION,
  JOURNEY_PERIODS_COLLECTION,
  SPECIFICATION_COLLECTION,
  NOTES_COLLECTION,
  TASKS_COLLECTION,
  TASK_NOTES_COLLECTION,
} from "./constants.js";
import { requestFilter, requestReferenceId } from "./references.js";
import { migrateLegacyNotes } from "./legacyMigration.js";
import { readJourneyPeriods } from "./journeys.js";
import { readSpecifications } from "./specification.js";
import { readNotes } from "./notes/queries.js";
import { readTasks } from "./tasks/queries.js";
import { normalizeRequestDocument } from "./normalization.js";
import { ensureIndexes } from "./indexes.js";
import { ensureRequestListRanks, requestListRank } from "./ordering.js";
import { readString } from "./support.js";
import { getPagination } from "../../helpers/query.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";

export async function readRequestById(
  db: Db,
  requestId: ObjectId,
  query: RepositoryQuery = {},
) {
  await loadRequestOptions(db, query);
  const request = await db
    .collection<RequestDocument>(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query));

  if (!request) return null;

  await migrateLegacyNotes(db, [request]);

  const [
    journeyPeriodsByRequestId,
    specificationByRequestId,
    notesByRequestId,
    tasksByRequestId,
  ] = await Promise.all([
    readJourneyPeriods(db, [requestId]),
    readSpecifications(db, [requestId]),
    readNotes(db, [requestId]),
    readTasks(db, [requestId]),
  ]);
  return normalizeRequestDocument(
    request,
    journeyPeriodsByRequestId.get(requestId.toString()) || [],
    specificationByRequestId.get(requestId.toString()),
    notesByRequestId.get(requestId.toString()) || [],
    tasksByRequestId.get(requestId.toString()) || [],
  );
}

export async function getRequest(
  requestIdValue: string | string[],
  query: RepositoryQuery = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const requestId = await requestReferenceId(db, requestIdValue, query);
  return { request: await readRequestById(db, requestId, query) };
}

export async function listRequests(query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const filter = buildKnowledgeContextFilter(query);
  const clientCode = readString(query.code).trim();
  if (clientCode) filter.clientCode = clientCode;
  if (Object.hasOwn(query, "collectionId")) {
    const collectionId = readString(query.collectionId).trim();
    filter.collectionId =
      collectionId === "__root__" ? { $in: ["", null] } : collectionId;
  }
  const requestedStatuses = String(query.status || "")
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  if (requestedStatuses.length) {
    const validStatuses = [...new Set(requestedStatuses)].filter((status) =>
      allRequestStatusOptions.includes(status),
    );
    filter.status =
      validStatuses.length === 1 ? validStatuses[0] : { $in: validStatuses };
  }
  const pagination = getPagination(query);
  const [requests, total] = await Promise.all([
    db
      .collection(REQUESTS_COLLECTION)
      .find(filter)
      .sort({ listRank: -1, updatedAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
    db.collection(REQUESTS_COLLECTION).countDocuments(filter),
  ]);
  await migrateLegacyNotes(db, requests);
  const requestIds = requests.map((request) => request._id);
  const [
    journeyPeriodsByRequestId,
    specificationByRequestId,
    notesByRequestId,
    tasksByRequestId,
  ] = await Promise.all([
    readJourneyPeriods(db, requestIds),
    readSpecifications(db, requestIds),
    readNotes(db, requestIds),
    readTasks(db, requestIds),
  ]);

  return {
    meta: {
      database: db.databaseName,
      collections: {
        requests: REQUESTS_COLLECTION,
        journeys: JOURNEY_PERIODS_COLLECTION,
        specifications: SPECIFICATION_COLLECTION,
        notes: NOTES_COLLECTION,
        tasks: TASKS_COLLECTION,
        taskNotes: TASK_NOTES_COLLECTION,
      },
      page: pagination.page,
      limit: pagination.limit,
      returned: requests.length,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      filter,
    },
    items: requests.map((request) =>
      normalizeRequestDocument(
        request,
        journeyPeriodsByRequestId.get(request._id.toString()) || [],
        specificationByRequestId.get(request._id.toString()),
        notesByRequestId.get(request._id.toString()) || [],
        tasksByRequestId.get(request._id.toString()) || [],
      ),
    ),
  };
}

export async function listRequestCollectionItems(query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const filter = buildKnowledgeContextFilter(query);
  const requestedStatuses = String(query.status || "")
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  if (requestedStatuses.length) {
    const validStatuses = [...new Set(requestedStatuses)].filter((status) =>
      allRequestStatusOptions.includes(status),
    );
    filter.status =
      validStatuses.length === 1 ? validStatuses[0] : { $in: validStatuses };
  }

  const items = await db
    .collection(REQUESTS_COLLECTION)
    .find(filter)
    .sort({ listRank: -1, updatedAt: -1, createdAt: -1 })
    .project({
      clientCode: 1,
      title: 1,
      status: 1,
      collectionId: 1,
      estimatedDeliveryDate: 1,
      startDate: 1,
      endDate: 1,
      listRank: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .toArray();
  const journeyPeriodsByRequestId = await readJourneyPeriods(
    db,
    items.map((item) => item._id),
  );

  return {
    meta: { total: items.length },
    items: items.map((document) => ({
      id: document._id.toString(),
      clientCode: document.clientCode || "",
      title: document.title || "",
      status: allRequestStatusOptions.includes(document.status)
        ? document.status
        : defaultRequestStatus,
      collectionId: document.collectionId || "",
      estimatedDeliveryDate: document.estimatedDeliveryDate || "",
      startDate: document.startDate || "",
      endDate: document.endDate || "",
      journeys: journeyPeriodsByRequestId.get(document._id.toString()) || [],
      listRank: requestListRank(document),
      createdAt: document.createdAt || null,
      updatedAt: document.updatedAt || null,
    })),
  };
}
