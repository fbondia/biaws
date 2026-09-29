import { ensureIndexes } from "./indexes.js";
import { loadIssueOptions } from "./options.js";
import {
  normalizeIssueCreatePayload,
  normalizeIssuePatchPayload,
} from "./normalization.js";
import { generateIssueId } from "./identifiers.js";
import { ISSUES_COLLECTION, COMMENTS_COLLECTION } from "./constants.js";
import { createHttpError, ensureIssueExists } from "./support.js";
import { hashComment } from "./comments/normalization.js";
import { getIssue } from "./queries.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { assertTaxonomyIdsApplicable } from "../../helpers/taxonomy.js";
import {
  buildKnowledgeContextFilter,
  knowledgeContextWasProvided,
  resolveKnowledgeContext,
} from "../shared/knowledgeContext.js";

export async function createIssue(payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  const issueOptions = await loadIssueOptions(db, query);
  const issue = normalizeIssueCreatePayload(payload, issueOptions);
  const context = await resolveKnowledgeContext(db, payload, null, {
    applicationRequired: true,
    authorizationScope: query.authorizationScope,
    create: true,
  });
  const now = new Date();
  const issueId = issue.id || (await generateIssueId(db, issue.date));
  const existing = await db
    .collection(ISSUES_COLLECTION)
    .findOne({ id: issueId }, { projection: { id: 1 } });

  if (existing) {
    throw createHttpError(409, `Issue already exists: ${issueId}`);
  }

  try {
    await db.collection(ISSUES_COLLECTION).insertOne({
      id: issueId,
      ...(issue.identifier ? { identifier: issue.identifier } : {}),
      ...context,
      type: issue.type,
      title: issue.title,
      text: issue.text,
      dates: {
        issueCreatedAt: issue.date,
        receivedEmailAt: issue.date,
        firstThreadEmailAt: issue.date,
        closedAt: issue.status === "closed" ? now : null,
      },
      status: issue.status,
      source: {
        kind: "api",
        createdBy: payload.createdBy || "biaws-api",
        ...issue.source,
      },
      attachments: [],
      createdAt: now,
      createdBy: payload.createdBy || "biaws-api",
      updatedAt: now,
      updatedBy: payload.createdBy || "biaws-api",
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError(409, `Issue already exists: ${issueId}`);
    }
    throw error;
  }

  if (issue.comment) {
    await db.collection(COMMENTS_COLLECTION).insertOne({
      issueId,
      hash: hashComment(issueId, issue.comment, now),
      text: issue.comment,
      from: payload.createdBy || "biaws-api",
      to: [],
      cc: [],
      date: now,
      rawDate: now.toISOString(),
      index: 0,
      source: {
        kind: "api",
      },
      createdAt: now,
    });
  }

  return {
    database: db.databaseName,
    issueId,
    ...(await getIssue(issueId, query)),
  };
}

export async function updateIssue(issueId, payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(ISSUES_COLLECTION);
  await ensureIndexes(db);
  const current = await ensureIssueExists(db, issueId, query);
  issueId = current.id;
  if (!current) {
    throw createHttpError(404, `Issue not found: ${issueId}`);
  }
  const issueOptions = await loadIssueOptions(db, query);
  const patch = normalizeIssuePatchPayload(payload, issueOptions);
  if (knowledgeContextWasProvided(payload)) {
    Object.assign(
      patch,
      await resolveKnowledgeContext(db, payload, current, {
        applicationRequired: true,
        authorizationScope: query.authorizationScope,
      }),
    );
    await assertTaxonomyIdsApplicable(
      db,
      [
        current.classification?.primaryTaxonomyId,
        ...(current.classification?.secondaryTaxonomyIds || []),
      ],
      patch.workspaceId,
      patch.applicationId,
    );
  }
  const now = new Date();

  if (Object.hasOwn(patch, "status")) {
    patch["dates.closedAt"] = patch.status === "closed" ? now : null;
  }

  const result = await collection.updateOne(
    { id: issueId, ...buildKnowledgeContextFilter(query) },
    {
      $set: {
        ...patch,
        updatedAt: now,
        updatedBy: payload.updatedBy || "biaws-ui",
      },
    },
  );

  return getIssue(issueId, query);
}
