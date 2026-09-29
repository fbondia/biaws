import type { RepositoryQuery } from "../../types/http.js";
import type { IssueDocument, IssueCommentDocument } from "../../types/issues.js";
import type { Filter } from "mongodb";
import { ensureIndexes } from "./indexes.js";
import { ISSUES_COLLECTION, COMMENTS_COLLECTION } from "./constants.js";
import { buildExpandedIssueFilter } from "./filters.js";
import { normalizeDocument } from "./normalization.js";
import { createHttpError } from "./support.js";
import { findByReference } from "../../helpers/referenceLookup.js";
import { buildIssueFilter, buildIssueSort, getPagination } from "../../helpers/query.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { expandTaxonomyIds } from "../../helpers/taxonomy.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";

export async function listIssues(query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  const collection = db.collection<IssueDocument>(ISSUES_COLLECTION);
  const filter = await buildExpandedIssueFilter(db, query);
  const sort = buildIssueSort(query);
  const pagination = getPagination(query);
  const [items, total] = await Promise.all([
    collection.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    meta: {
      database: db.databaseName,
      collection: ISSUES_COLLECTION,
      page: pagination.page,
      limit: pagination.limit,
      skip: pagination.skip,
      returned: items.length,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      sort,
      filter,
    },
    items: items.map((item) => normalizeDocument(item)),
  };
}

export async function getIssue(issueId: string | string[], query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const issue = await findByReference<IssueDocument>(db.collection<IssueDocument>(ISSUES_COLLECTION), issueId, {
    filter: buildKnowledgeContextFilter(query),
    identifierField: "identifier",
  });
  const comments =
    issue && query.includeComments !== false && query.includeComments !== "false"
      ? await db
          .collection<IssueCommentDocument>(COMMENTS_COLLECTION)
          .find({ issueId: issue.id })
          .sort({ date: -1, createdAt: -1, index: -1, _id: -1 })
          .toArray()
      : [];

  return {
    database: db.databaseName,
    issue: normalizeDocument(issue),
    comments: comments.map((comment) => normalizeDocument(comment)),
  };
}

export async function listIssuesByTaxonomy(taxonomyId: string | string[], query: RepositoryQuery = {}) {
  const normalizedTaxonomyId = String(taxonomyId || "").trim();
  if (!normalizedTaxonomyId) {
    throw createHttpError(422, "taxonomyId is required");
  }

  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const pagination = getPagination(query);
  const taxonomyIds = await expandTaxonomyIds(
    db,
    [normalizedTaxonomyId],
    query.authorizationScope?.workspaceId || query.workspaceId,
  );
  const filter: Record<string, unknown> = {
    ...buildKnowledgeContextFilter(query),
    $or: [
      { "classification.primaryTaxonomyId": { $in: taxonomyIds } },
      { "classification.secondaryTaxonomyIds": { $in: taxonomyIds } },
    ],
  };

  const optionFilter = buildIssueFilter({
    status: query.status,
    type: query.type || query.tipo,
    workspaceId: query.workspaceId,
    applicationId: query.applicationId,
    componentId: query.componentId || query.affectedComponentId,
  });
  if (optionFilter.status) filter.status = optionFilter.status;
  if (!query.authorizationScope && optionFilter.workspaceId) {
    filter.workspaceId = optionFilter.workspaceId;
  }
  if (!query.authorizationScope && optionFilter.applicationId) {
    filter.applicationId = optionFilter.applicationId;
  }
  if (optionFilter.affectedComponentIds) {
    filter.affectedComponentIds = optionFilter.affectedComponentIds;
  }
  if (optionFilter.type) filter.type = optionFilter.type;

  const [items, total] = await Promise.all([
    db
      .collection<IssueDocument>(ISSUES_COLLECTION)
      .find(filter as Filter<IssueDocument>)
      .sort({ "dates.receivedEmailAt": -1, updatedAt: -1, id: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
    db.collection(ISSUES_COLLECTION).countDocuments(filter),
  ]);

  return {
    meta: {
      database: db.databaseName,
      collection: ISSUES_COLLECTION,
      taxonomyId: normalizedTaxonomyId,
      taxonomyIds,
      page: pagination.page,
      limit: pagination.limit,
      skip: pagination.skip,
      returned: items.length,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      filter,
    },
    items: items.map(normalizeDocument),
  };
}
