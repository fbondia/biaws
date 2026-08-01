import { randomUUID } from "node:crypto";

import { CATALOG_LIMITS } from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import {
  actorId,
  archiveFields,
  assertAllowedFields,
  buildScopedListFilter,
  createBaseDocument,
  createCatalogError,
  duplicateKeyError,
  normalizeDocument,
  normalizeKey,
  optionalText,
  pagination,
  requiredText,
  requireOperationalApplication,
} from "./topologyRepositorySupport.js";

const STATUSES = ["active", "archived"];
let collectionPromise;

async function getCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const database = await getMongoDatabase();
      const collection = database.collection(
        COLLECTION_NAMES.APPLICATION_INTEGRATIONS,
      );
      await Promise.all([
        collection.createIndex({ id: 1 }, { unique: true }),
        collection.createIndex(
          { workspaceId: 1, applicationId: 1, key: 1 },
          { unique: true },
        ),
        collection.createIndex(
          { workspaceId: 1, applicationId: 1, targetApplicationId: 1 },
          { unique: true },
        ),
        collection.createIndex({
          workspaceId: 1,
          targetApplicationId: 1,
          status: 1,
        }),
      ]);
      return collection;
    })();
  }
  return collectionPromise;
}

export function normalizeIntegrationInput(payload = {}, current = null) {
  assertAllowedFields(
    payload,
    ["key", "name", "description", "targetApplicationId"],
    "integration",
  );
  const targetApplicationId = requiredText(
    payload.targetApplicationId ?? current?.targetApplicationId,
    "targetApplicationId",
    100,
  );
  if (current && targetApplicationId !== current.targetApplicationId) {
    throw createCatalogError(
      409,
      "INTEGRATION_TARGET_IMMUTABLE",
      "integration target application cannot be changed",
    );
  }
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(
      payload.name ?? current?.name,
      "name",
      CATALOG_LIMITS.name,
    ),
    description: optionalText(
      payload.description ?? current?.description,
      "description",
      CATALOG_LIMITS.description,
    ),
    targetApplicationId,
  };
}

async function validateTarget(application, targetApplicationId) {
  if (application.id === targetApplicationId) {
    throw createCatalogError(
      422,
      "INTEGRATION_SELF_REFERENCE",
      "an application cannot integrate with itself",
    );
  }
  try {
    return await requireOperationalApplication(targetApplicationId, {
      active: true,
      workspaceId: application.workspaceId,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      throw createCatalogError(
        422,
        "INVALID_INTEGRATION_TARGET",
        "target application must be active and belong to the same workspace",
      );
    }
    throw error;
  }
}

export async function listIntegrations(applicationId, query = {}) {
  const application = await requireOperationalApplication(applicationId);
  const collection = await getCollection();
  const filter = buildScopedListFilter({
    workspaceId: application.workspaceId,
    applicationId: application.id,
    statuses: STATUSES,
    query,
  });
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.APPLICATION_INTEGRATIONS,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map(normalizeDocument),
  };
}

export async function getIntegration(
  integrationId,
  { applicationId, workspaceId } = {},
) {
  const collection = await getCollection();
  const filter = { id: String(integrationId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const integration = normalizeDocument(await collection.findOne(filter));
  if (!integration) return null;
  await requireOperationalApplication(integration.applicationId, {
    workspaceId: integration.workspaceId,
  });
  return integration;
}

export async function createIntegration(
  applicationId,
  payload = {},
  actor = {},
) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const normalized = normalizeIntegrationInput(payload);
  await validateTarget(application, normalized.targetApplicationId);
  const document = {
    id: randomUUID(),
    ...createBaseDocument({
      key: normalized.key,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      actor,
    }),
    ...normalized,
  };
  try {
    await (await getCollection()).insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "INTEGRATION_CONFLICT",
      "An integration with this key or target already exists in the application",
    );
  }
  return normalizeDocument(document);
}

export async function updateIntegration(
  integrationId,
  payload = {},
  actor = {},
) {
  const current = await getIntegration(integrationId);
  if (!current) {
    throw createCatalogError(
      404,
      "INTEGRATION_NOT_FOUND",
      "Integration not found",
    );
  }
  if (current.status !== "active") {
    throw createCatalogError(
      409,
      "INTEGRATION_ARCHIVED",
      "Integration is archived",
    );
  }
  const application = await requireOperationalApplication(
    current.applicationId,
    { active: true, workspaceId: current.workspaceId },
  );
  const normalized = normalizeIntegrationInput(payload, current);
  await validateTarget(application, normalized.targetApplicationId);
  try {
    await (
      await getCollection()
    ).updateOne(
      { id: current.id, status: "active" },
      {
        $set: {
          ...normalized,
          updatedAt: new Date(),
          updatedBy: actorId(actor),
        },
      },
    );
  } catch (error) {
    duplicateKeyError(
      error,
      "INTEGRATION_CONFLICT",
      "An integration with this key or target already exists in the application",
    );
  }
  return getIntegration(current.id);
}

export async function archiveIntegration(integrationId, actor = {}) {
  const current = await getIntegration(integrationId);
  if (!current) {
    throw createCatalogError(
      404,
      "INTEGRATION_NOT_FOUND",
      "Integration not found",
    );
  }
  if (current.status === "archived") return current;
  await (
    await getCollection()
  ).updateOne(
    { id: current.id, status: "active" },
    { $set: archiveFields(actor) },
  );
  return getIntegration(current.id);
}

export async function assertNoActiveApplicationIntegrations(
  workspaceId,
  applicationId,
) {
  const count = await (
    await getCollection()
  ).countDocuments({
    workspaceId: String(workspaceId),
    status: "active",
    $or: [
      { applicationId: String(applicationId) },
      { targetApplicationId: String(applicationId) },
    ],
  });
  if (count) {
    throw createCatalogError(
      409,
      "APPLICATION_INTEGRATION_IN_USE",
      "Archive integrations involving the application before archiving it",
    );
  }
}
