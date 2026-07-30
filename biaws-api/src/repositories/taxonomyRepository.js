import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

const TAXONOMIES_COLLECTION = COLLECTION_NAMES.TAXONOMIES;
const ACTIVE_TAXONOMY_KEY = "biaws";
const ACTIVE_STATUS = "active";

function normalizeDocument(document) {
  if (!document) return null;

  return {
    ...document,
    _id: document._id?.toString?.() ?? document._id,
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw createHttpError(
      422,
      `Invalid taxonomy payload: ${fieldName} must be a non-empty string`,
    );
  }
}

function assertOptionalColor(value, fieldName) {
  if (value === undefined || value === null || value === "") return;

  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/iu.test(value)) {
    throw createHttpError(
      422,
      `Invalid taxonomy payload: ${fieldName} must be a hex color`,
    );
  }
}

function assertTagGroups(tagGroups) {
  if (!Array.isArray(tagGroups)) {
    throw createHttpError(
      422,
      "Invalid taxonomy payload: tagGroups must be an array",
    );
  }

  for (const [index, group] of tagGroups.entries()) {
    assertString(group?.id, `tagGroups[${index}].id`);
    assertString(group?.label, `tagGroups[${index}].label`);
    assertOptionalColor(group?.color, `tagGroups[${index}].color`);

    if (!Array.isArray(group.tags)) {
      throw createHttpError(
        422,
        `Invalid taxonomy payload: tagGroups[${index}].tags must be an array`,
      );
    }

    for (const [tagIndex, tag] of group.tags.entries()) {
      assertString(tag, `tagGroups[${index}].tags[${tagIndex}]`);
    }
  }
}

function assertTaxonomyNodes(nodes, path = "taxonomy") {
  if (!Array.isArray(nodes)) {
    throw createHttpError(
      422,
      `Invalid taxonomy payload: ${path} must be an array`,
    );
  }

  for (const [index, node] of nodes.entries()) {
    const nodePath = `${path}[${index}]`;
    assertString(node?.id, `${nodePath}.id`);
    assertString(node?.label, `${nodePath}.label`);

    if (node.children !== undefined) {
      assertTaxonomyNodes(node.children, `${nodePath}.children`);
    }
  }
}

function normalizeTaxonomyPayload(payload = {}) {
  const schemaVersion = Number(payload.schemaVersion || 1);

  if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) {
    throw createHttpError(
      422,
      "Invalid taxonomy payload: schemaVersion must be a positive integer",
    );
  }

  assertTagGroups(payload.tagGroups);
  assertTaxonomyNodes(payload.taxonomy);

  return {
    schemaVersion,
    source: payload.source || null,
    tagGroups: payload.tagGroups,
    taxonomy: payload.taxonomy,
  };
}

async function ensureTaxonomyIndexes(collection) {
  await collection.createIndex(
    { workspaceId: 1, key: 1, status: 1 },
    { unique: true },
  );
}

function workspaceId(query = {}) {
  return String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
}

export async function getIssueTaxonomy(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(TAXONOMIES_COLLECTION);
  await ensureTaxonomyIndexes(collection);
  const taxonomy = await collection.findOne({
    workspaceId: workspaceId(query),
    key: ACTIVE_TAXONOMY_KEY,
    status: ACTIVE_STATUS,
  });

  return {
    meta: {
      database: db.databaseName,
      collection: TAXONOMIES_COLLECTION,
      key: ACTIVE_TAXONOMY_KEY,
      status: ACTIVE_STATUS,
    },
    taxonomy: normalizeDocument(taxonomy),
  };
}

export async function saveIssueTaxonomy(payload, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(TAXONOMIES_COLLECTION);
  await ensureTaxonomyIndexes(collection);

  const taxonomyPackage = normalizeTaxonomyPayload(payload);
  const now = new Date();

  await collection.updateOne(
    {
      workspaceId: workspaceId(query),
      key: ACTIVE_TAXONOMY_KEY,
      status: ACTIVE_STATUS,
    },
    {
      $set: {
        ...taxonomyPackage,
        workspaceId: workspaceId(query),
        key: ACTIVE_TAXONOMY_KEY,
        status: ACTIVE_STATUS,
        updatedAt: now,
        updatedBy: payload.updatedBy || "biaws-ui",
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return getIssueTaxonomy(query);
}
