import crypto from "crypto";

import {
  DEFAULT_ISSUE_STATUS,
  DEFAULT_ISSUE_TYPE,
  ISSUE_STATUS_OPTIONS,
  ISSUE_TYPE_OPTIONS,
} from "../../../shared/issueConstants.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import {
  buildIssueFilter,
  buildIssueSort,
  getPagination,
  getSummaryOptions,
} from "../helpers/query.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import {
  assertTaxonomyIdsApplicable,
  expandTaxonomyIds,
} from "../helpers/taxonomy.js";
import {
  buildKnowledgeContextFilter,
  knowledgeContextWasProvided,
  resolveKnowledgeContext,
} from "./knowledgeContextRepository.js";
import { activeValues, getIssueOptionLists } from "./optionListsRepository.js";

const ISSUES_COLLECTION = COLLECTION_NAMES.ISSUES;
const COMMENTS_COLLECTION = COLLECTION_NAMES.ISSUE_COMMENTS;

async function loadIssueOptions(db, query = {}) {
  const lists = await getIssueOptionLists({
    db: db.databaseName,
    authorizationScope: query.authorizationScope,
    workspaceId: query.workspaceId,
  });
  const types = activeValues(lists.types);
  const statuses = activeValues(lists.statuses);

  return {
    types: types.length ? types : ISSUE_TYPE_OPTIONS.map((item) => item.value),
    statuses: statuses.length
      ? statuses
      : ISSUE_STATUS_OPTIONS.map((item) => item.value),
    defaultType: lists.types?.defaultValue || types[0] || DEFAULT_ISSUE_TYPE,
    defaultStatus:
      lists.statuses?.defaultValue || statuses[0] || DEFAULT_ISSUE_STATUS,
  };
}

function readTaxonomyIds(query = {}) {
  return String(query.taxonomy || query.taxonomyIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function buildExpandedIssueFilter(db, query) {
  const taxonomyIds = await expandTaxonomyIds(
    db,
    readTaxonomyIds(query),
    query.authorizationScope?.workspaceId || query.workspaceId,
  );
  return {
    ...buildIssueFilter(query, { taxonomyIds }),
    ...buildKnowledgeContextFilter(query),
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDocument(document) {
  if (!document) return null;

  const { jiraCreatedAt, jiraUpdatedAt, jiraResolutionDate, ...dates } =
    document.dates || {};
  const { jira, ...source } = document.source || {};

  return {
    ...document,
    _id: document._id?.toString?.() ?? document._id,
    ...(document.dates ? { dates } : {}),
    ...(document.source ? { source } : {}),
  };
}

function normalizeStringArray(value, fieldName) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw createHttpError(
      422,
      `Invalid classification payload: ${fieldName} must be an array`,
    );
  }

  return [
    ...new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  ];
}

function normalizeClassificationPayload(payload = {}) {
  const primaryTaxonomyId = String(payload.primaryTaxonomyId || "").trim();
  const summary = String(payload.summary || "").trim();
  const secondaryTaxonomyIds = normalizeStringArray(
    payload.secondaryTaxonomyIds,
    "secondaryTaxonomyIds",
  ).filter((taxonomyId) => taxonomyId !== primaryTaxonomyId);
  const tags = {};

  if (
    payload.tags !== undefined &&
    (payload.tags === null || typeof payload.tags !== "object")
  ) {
    throw createHttpError(
      422,
      "Invalid classification payload: tags must be an object",
    );
  }

  for (const [groupId, tagIds] of Object.entries(payload.tags || {})) {
    const normalizedGroupId = String(groupId || "").trim();
    if (!normalizedGroupId) continue;
    tags[normalizedGroupId] = normalizeStringArray(
      tagIds,
      `tags.${normalizedGroupId}`,
    );
  }

  return {
    primaryTaxonomyId,
    secondaryTaxonomyIds,
    summary,
    tags,
  };
}

function normalizeIssuePatchPayload(payload = {}, issueOptions) {
  const $set = {};

  if (Object.hasOwn(payload, "type")) {
    const type = String(payload.type || "").trim();
    if (!issueOptions.types.includes(type)) {
      throw createHttpError(
        422,
        `Invalid issue payload: type must be one of ${issueOptions.types.join(", ")}`,
      );
    }
    $set.type = type;
  }

  if (Object.hasOwn(payload, "status")) {
    const status = String(payload.status || "").trim();
    if (!issueOptions.statuses.includes(status)) {
      throw createHttpError(
        422,
        `Invalid issue payload: status must be one of ${issueOptions.statuses.join(", ")}`,
      );
    }
    $set.status = status;
  }

  if (!Object.keys($set).length && !knowledgeContextWasProvided(payload)) {
    throw createHttpError(
      422,
      "Invalid issue payload: type, status or application context is required",
    );
  }

  return $set;
}

async function ensureIndexes(db) {
  await Promise.all([
    db
      .collection(ISSUES_COLLECTION)
      .createIndex({ id: 1 }, { unique: true, name: "issue_id_unique" }),
    db.collection(ISSUES_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      updatedAt: -1,
      id: 1,
    }),
    db.collection(ISSUES_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      "dates.receivedEmailAt": -1,
      updatedAt: -1,
      id: 1,
    }),
    db.collection(ISSUES_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      affectedComponentIds: 1,
    }),
  ]);
}

function parseIssueDate(value, fallback = new Date()) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(
      422,
      `Invalid issue payload: date must be a valid date`,
    );
  }
  return date;
}

function formatDateLabel(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function generateIssueId(db, date = new Date()) {
  const prefix = `${formatDateLabel(date)}-`;
  const existing = await db
    .collection(ISSUES_COLLECTION)
    .find({ id: { $regex: `^${prefix}\\d{3}$` } })
    .project({ id: 1 })
    .sort({ id: -1 })
    .limit(1)
    .toArray();
  const lastId = existing[0]?.id || "";
  const lastSeq = Number(lastId.slice(prefix.length)) || 0;

  return `${prefix}${String(lastSeq + 1).padStart(3, "0")}`;
}

function normalizeIssueCreatePayload(payload = {}, issueOptions) {
  const title = String(payload.title || "").trim();
  const text = String(payload.text || "").trim();
  const type = String(payload.type || issueOptions.defaultType).trim();
  const status = String(payload.status || issueOptions.defaultStatus).trim();

  if (!title)
    throw createHttpError(422, "Invalid issue payload: title is required");
  if (!text)
    throw createHttpError(422, "Invalid issue payload: text is required");
  if (!issueOptions.types.includes(type)) {
    throw createHttpError(
      422,
      `Invalid issue payload: type must be one of ${issueOptions.types.join(", ")}`,
    );
  }
  if (!issueOptions.statuses.includes(status)) {
    throw createHttpError(
      422,
      `Invalid issue payload: status must be one of ${issueOptions.statuses.join(", ")}`,
    );
  }

  return {
    id: String(payload.id || "").trim(),
    type,
    status,
    title,
    text,
    date: parseIssueDate(payload.date),
    comment: String(payload.comment || "").trim(),
    source:
      payload.source &&
      typeof payload.source === "object" &&
      !Array.isArray(payload.source)
        ? payload.source
        : {},
  };
}

function hashComment(issueId, text, date) {
  return crypto
    .createHash("sha256")
    .update(`${issueId}\n${date.toISOString()}\n${text}`)
    .digest("hex");
}

function withDateType(filter, datePath) {
  const existingDateFilter = filter[datePath];

  return {
    ...filter,
    [datePath]: {
      ...(existingDateFilter &&
      typeof existingDateFilter === "object" &&
      !Array.isArray(existingDateFilter)
        ? existingDateFilter
        : {}),
      $type: "date",
    },
  };
}

function normalizeBucket(bucket, fallbackLabel = "sem valor") {
  return {
    key: bucket._id ?? fallbackLabel,
    count: bucket.count,
  };
}

function normalizeDateBucket(bucket, interval) {
  if (interval === "week" && bucket._id?.year && bucket._id?.week) {
    return {
      key: `${bucket._id.year}-W${String(bucket._id.week).padStart(2, "0")}`,
      count: bucket.count,
    };
  }

  return normalizeBucket(bucket);
}

function normalizeDateFieldBucket(bucket) {
  return {
    key: bucket._id ?? "sem valor",
    count: bucket.count,
    ...Object.fromEntries(
      (bucket.fields || []).map((field) => [
        field.key ?? "sem valor",
        field.count,
      ]),
    ),
  };
}

function normalizeTaxonomyBucket(bucket) {
  return {
    ...normalizeBucket(bucket),
    issues: (bucket.issues || []).map((issue) => ({
      id: issue.id,
      title: issue.title,
      type: issue.type,
      status: issue.status,
      date: issue.date,
    })),
  };
}

async function aggregateByField(collection, filter, fieldName) {
  const rows = await collection
    .aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $ifNull: [`$${fieldName}`, "sem valor"],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ])
    .toArray();

  return rows.map(normalizeBucket);
}

async function aggregateByTaxonomy(collection, filter, options = {}) {
  const datePath = options.datePath || "dates.receivedEmailAt";
  const rows = await collection
    .aggregate([
      {
        $match: {
          ...filter,
          "classification.primaryTaxonomyId": { $type: "string", $ne: "" },
        },
      },
      { $sort: { [datePath]: -1, _id: 1 } },
      {
        $group: {
          _id: "$classification.primaryTaxonomyId",
          count: { $sum: 1 },
          issues: {
            $push: {
              id: "$id",
              title: "$title",
              type: "$type",
              status: "$status",
              date: `$${datePath}`,
            },
          },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ])
    .toArray();

  return rows.map(normalizeTaxonomyBucket);
}

async function aggregateByDate(collection, filter, options) {
  if (options.interval === "week") {
    const rows = await collection
      .aggregate([
        { $match: withDateType(filter, options.datePath) },
        {
          $group: {
            _id: {
              year: {
                $isoWeekYear: {
                  date: `$${options.datePath}`,
                  timezone: options.timezone,
                },
              },
              week: {
                $isoWeek: {
                  date: `$${options.datePath}`,
                  timezone: options.timezone,
                },
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } },
      ])
      .toArray();

    return rows.map((row) => normalizeDateBucket(row, options.interval));
  }

  const rows = await collection
    .aggregate([
      { $match: withDateType(filter, options.datePath) },
      {
        $group: {
          _id: {
            $dateToString: {
              format: options.dateFormat,
              date: `$${options.datePath}`,
              timezone: options.timezone,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return rows.map((row) => normalizeDateBucket(row, options.interval));
}

async function aggregateByDateAndField(collection, filter, options, fieldName) {
  const rows = await collection
    .aggregate([
      { $match: withDateType(filter, options.datePath) },
      {
        $group: {
          _id: {
            bucket: {
              $dateToString: {
                format: options.dateFormat,
                date: `$${options.datePath}`,
                timezone: options.timezone,
              },
            },
            field: {
              $ifNull: [`$${fieldName}`, "sem valor"],
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.bucket",
          count: { $sum: "$count" },
          fields: {
            $push: {
              key: "$_id.field",
              count: "$count",
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return rows.map(normalizeDateFieldBucket);
}

export async function listIssues(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  const collection = db.collection(ISSUES_COLLECTION);
  const filter = await buildExpandedIssueFilter(db, query);
  const sort = buildIssueSort(query);
  const pagination = getPagination(query);
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
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
    items: items.map(normalizeDocument),
  };
}

export async function getIssue(issueId, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const issue = await db.collection(ISSUES_COLLECTION).findOne({
    id: issueId,
    ...buildKnowledgeContextFilter(query),
  });
  const comments = issue
    ? await db
        .collection(COMMENTS_COLLECTION)
        .find({ issueId })
        .sort({ index: 1, date: 1, createdAt: 1, _id: 1 })
        .toArray()
    : [];

  return {
    database: db.databaseName,
    issue: normalizeDocument(issue),
    comments: comments.map(normalizeDocument),
  };
}

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

export async function saveIssueClassification(
  issueId,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(ISSUES_COLLECTION);
  const classification = normalizeClassificationPayload(payload);
  const now = new Date();
  const issue = await collection.findOne(
    { id: issueId, ...buildKnowledgeContextFilter(query) },
    { projection: { workspaceId: 1, applicationId: 1 } },
  );
  if (!issue) throw createHttpError(404, `Issue not found: ${issueId}`);
  await assertTaxonomyIdsApplicable(
    db,
    [classification.primaryTaxonomyId, ...classification.secondaryTaxonomyIds],
    issue.workspaceId,
    issue.applicationId,
  );

  const result = await collection.updateOne(
    { id: issueId, ...buildKnowledgeContextFilter(query) },
    {
      $set: {
        classification: {
          ...classification,
          updatedAt: now,
          updatedBy: payload.updatedBy || "biaws-ui",
        },
        updatedAt: now,
        updatedBy: payload.updatedBy || "biaws-ui",
      },
    },
  );

  if (!result.matchedCount) {
    throw createHttpError(404, `Issue not found: ${issueId}`);
  }

  return getIssue(issueId, query);
}

export async function updateIssue(issueId, payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(ISSUES_COLLECTION);
  await ensureIndexes(db);
  const current = await collection.findOne({
    id: issueId,
    ...buildKnowledgeContextFilter(query),
  });
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

export async function listIssuesByTaxonomy(taxonomyId, query = {}) {
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
  const filter = {
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
      .collection(ISSUES_COLLECTION)
      .find(filter)
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

export async function summarizeIssues(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(ISSUES_COLLECTION);
  const filter = await buildExpandedIssueFilter(db, query);
  const dayOptions = getSummaryOptions(query, "day");
  const weekOptions = getSummaryOptions(query, "week");
  const monthOptions = getSummaryOptions(query, "month");
  const yearOptions = getSummaryOptions(query, "year");
  const [total, byDate, byWeek, byMonth, byYear, byType, byStatus, byTaxonomy] =
    await Promise.all([
      collection.countDocuments(filter),
      aggregateByDate(collection, filter, dayOptions),
      aggregateByDate(collection, filter, weekOptions),
      aggregateByDateAndField(collection, filter, monthOptions, "type"),
      aggregateByDateAndField(collection, filter, yearOptions, "type"),
      aggregateByField(collection, filter, "type"),
      aggregateByField(collection, filter, "status"),
      aggregateByTaxonomy(collection, filter, dayOptions),
    ]);

  return {
    meta: {
      database: db.databaseName,
      collection: ISSUES_COLLECTION,
      total,
      dateField: dayOptions.dateField,
      timezone: dayOptions.timezone,
      filter,
    },
    byDate,
    byWeek,
    byMonth,
    byYear,
    byType,
    byStatus,
    byTaxonomy,
  };
}

function getAggregateDateOptions(query, groupBy) {
  if (groupBy === "date") return getSummaryOptions(query);
  if (["day", "week", "month", "year"].includes(groupBy)) {
    return getSummaryOptions(query, groupBy);
  }
  return null;
}

export async function aggregateIssues(query = {}, groupBy) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(ISSUES_COLLECTION);
  const filter = await buildExpandedIssueFilter(db, query);
  const summaryOptions = getAggregateDateOptions(query, groupBy);
  const items = summaryOptions
    ? await aggregateByDate(collection, filter, summaryOptions)
    : groupBy === "taxonomy"
      ? await aggregateByTaxonomy(collection, filter, getSummaryOptions(query))
      : await aggregateByField(collection, filter, groupBy);

  return {
    meta: {
      database: db.databaseName,
      collection: ISSUES_COLLECTION,
      groupBy,
      ...(summaryOptions
        ? {
            dateField: summaryOptions.dateField,
            interval: summaryOptions.interval,
            timezone: summaryOptions.timezone,
          }
        : {}),
      filter,
    },
    items,
  };
}
