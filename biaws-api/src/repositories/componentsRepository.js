import { randomUUID } from "node:crypto";

import {
  CATALOG_LIMITS,
  COMPONENT_STATUSES,
  COMPONENT_TYPES,
  REPOSITORY_LINK_ROLES,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import {
  actorId,
  archiveFields,
  assertAllowedFields,
  buildScopedListFilter,
  createBaseDocument,
  createCatalogError,
  duplicateKeyError,
  getTopologyCollections,
  normalizeDocument,
  normalizeEnum,
  normalizeKey,
  normalizeTags,
  optionalText,
  pagination,
  requiredText,
  requireOperationalApplication,
} from "./topologyRepositorySupport.js";

function normalizeRepositoryLinks(value, current = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > CATALOG_LIMITS.relationships) {
    throw createCatalogError(
      422,
      "INVALID_COMPONENT_RELATIONSHIP",
      `repositoryLinks must be an array with at most ${CATALOG_LIMITS.relationships} items`,
    );
  }
  const unique = new Map();
  value.forEach((link, index) => {
    if (!link || typeof link !== "object" || Array.isArray(link)) {
      throw createCatalogError(
        422,
        "INVALID_COMPONENT_RELATIONSHIP",
        `repositoryLinks[${index}] must be an object`,
      );
    }
    assertAllowedFields(
      link,
      ["repositoryId", "role"],
      `repositoryLinks[${index}]`,
    );
    const repositoryId = requiredText(
      link.repositoryId,
      `repositoryLinks[${index}].repositoryId`,
      100,
    );
    if (unique.has(repositoryId)) {
      throw createCatalogError(
        422,
        "INVALID_COMPONENT_RELATIONSHIP",
        `repository is linked more than once: ${repositoryId}`,
      );
    }
    unique.set(repositoryId, {
      repositoryId,
      role: normalizeEnum(
        link.role,
        `repositoryLinks[${index}].role`,
        REPOSITORY_LINK_ROLES,
        "source",
      ),
    });
  });
  return [...unique.values()];
}

function normalizeDependencies(value, current = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > CATALOG_LIMITS.relationships) {
    throw createCatalogError(
      422,
      "INVALID_COMPONENT_RELATIONSHIP",
      `dependencies must be an array with at most ${CATALOG_LIMITS.relationships} items`,
    );
  }
  const unique = new Map();
  value.forEach((dependency, index) => {
    if (
      !dependency ||
      typeof dependency !== "object" ||
      Array.isArray(dependency)
    ) {
      throw createCatalogError(
        422,
        "INVALID_COMPONENT_RELATIONSHIP",
        `dependencies[${index}] must be an object`,
      );
    }
    assertAllowedFields(
      dependency,
      ["componentId", "kind", "description"],
      `dependencies[${index}]`,
    );
    const componentId = requiredText(
      dependency.componentId,
      `dependencies[${index}].componentId`,
      100,
    );
    if (unique.has(componentId)) {
      throw createCatalogError(
        422,
        "INVALID_COMPONENT_RELATIONSHIP",
        `component is declared more than once as a dependency: ${componentId}`,
      );
    }
    unique.set(componentId, {
      componentId,
      kind: optionalText(
        dependency.kind,
        `dependencies[${index}].kind`,
        CATALOG_LIMITS.dependencyKind,
      ),
      description: optionalText(
        dependency.description,
        `dependencies[${index}].description`,
        CATALOG_LIMITS.description,
      ),
    });
  });
  return [...unique.values()];
}

export function normalizeComponentInput(payload = {}, current = null) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "description",
      "type",
      "repositoryLinks",
      "dependencies",
      "tags",
    ],
    "component",
  );
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
    type: normalizeEnum(
      payload.type,
      "type",
      COMPONENT_TYPES,
      current?.type || "other",
    ),
    repositoryLinks: normalizeRepositoryLinks(
      payload.repositoryLinks,
      current?.repositoryLinks,
    ),
    dependencies: normalizeDependencies(
      payload.dependencies,
      current?.dependencies,
    ),
    tags: normalizeTags(payload.tags, current?.tags),
  };
}

async function validateRelationships(application, component) {
  const { components, repositories } = await getTopologyCollections();
  const repositoryIds = component.repositoryLinks.map(
    ({ repositoryId }) => repositoryId,
  );
  const dependencyIds = component.dependencies.map(
    ({ componentId }) => componentId,
  );
  if (component.id && dependencyIds.includes(component.id)) {
    throw createCatalogError(
      422,
      "COMPONENT_SELF_DEPENDENCY",
      "a component cannot depend on itself",
    );
  }

  const [repositoryCount, dependencyCount] = await Promise.all([
    repositoryIds.length
      ? repositories.countDocuments({
          id: { $in: repositoryIds },
          workspaceId: application.workspaceId,
          applicationId: application.id,
          status: "active",
        })
      : 0,
    dependencyIds.length
      ? components.countDocuments({
          id: { $in: dependencyIds },
          workspaceId: application.workspaceId,
          applicationId: application.id,
          status: "active",
        })
      : 0,
  ]);
  if (repositoryCount !== repositoryIds.length) {
    throw createCatalogError(
      422,
      "INVALID_COMPONENT_REPOSITORY",
      "all linked repositories must be active and belong to the application",
    );
  }
  if (dependencyCount !== dependencyIds.length) {
    throw createCatalogError(
      422,
      "INVALID_COMPONENT_DEPENDENCY",
      "all dependencies must be active components of the application",
    );
  }
}

export async function listComponents(applicationId, query = {}) {
  const application = await requireOperationalApplication(applicationId);
  const { components } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: application.workspaceId,
    applicationId: application.id,
    statuses: COMPONENT_STATUSES,
    query,
  });
  if (query.type)
    filter.type = normalizeEnum(query.type, "type", COMPONENT_TYPES);
  if (query.repositoryId) {
    filter["repositoryLinks.repositoryId"] = String(query.repositoryId);
  }
  if (query.dependencyComponentId) {
    filter["dependencies.componentId"] = String(query.dependencyComponentId);
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    components
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    components.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.APPLICATION_COMPONENTS,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map(normalizeDocument),
  };
}

export async function getComponent(
  componentId,
  { applicationId, workspaceId } = {},
) {
  const { components } = await getTopologyCollections();
  const filter = { id: String(componentId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const component = normalizeDocument(await components.findOne(filter));
  if (!component) return null;
  await requireOperationalApplication(component.applicationId, {
    workspaceId: component.workspaceId,
  });
  return component;
}

export async function createComponent(applicationId, payload = {}, actor = {}) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const { components } = await getTopologyCollections();
  const normalized = normalizeComponentInput(payload);
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
  await validateRelationships(application, document);
  try {
    await components.insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "COMPONENT_KEY_CONFLICT",
      "A component with this key already exists in the application",
    );
  }
  return normalizeDocument(document);
}

export async function updateComponent(componentId, payload = {}, actor = {}) {
  const current = await getComponent(componentId);
  if (!current) {
    throw createCatalogError(404, "COMPONENT_NOT_FOUND", "Component not found");
  }
  if (current.status !== "active") {
    throw createCatalogError(
      409,
      "COMPONENT_ARCHIVED",
      "Component is archived",
    );
  }
  const application = await requireOperationalApplication(
    current.applicationId,
    {
      active: true,
      workspaceId: current.workspaceId,
    },
  );
  const normalized = normalizeComponentInput(payload, current);
  const candidate = { ...current, ...normalized };
  await validateRelationships(application, candidate);
  const { components } = await getTopologyCollections();
  let result;
  try {
    result = await components.updateOne(
      {
        id: current.id,
        workspaceId: current.workspaceId,
        applicationId: current.applicationId,
        status: "active",
      },
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
      "COMPONENT_KEY_CONFLICT",
      "A component with this key already exists in the application",
    );
  }
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "COMPONENT_CONCURRENT_UPDATE",
      "Component changed concurrently; reload and try again",
    );
  }
  return getComponent(current.id);
}

export async function archiveComponent(componentId, actor = {}) {
  const current = await getComponent(componentId);
  if (!current) {
    throw createCatalogError(404, "COMPONENT_NOT_FOUND", "Component not found");
  }
  if (current.status === "archived") return current;
  const { components, deployments } = await getTopologyCollections();
  const [dependentComponents, activeDeployments] = await Promise.all([
    components.countDocuments({
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: "active",
      "dependencies.componentId": current.id,
    }),
    deployments.countDocuments({
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      componentId: current.id,
      status: { $ne: "archived" },
    }),
  ]);
  if (dependentComponents || activeDeployments) {
    throw createCatalogError(
      409,
      "COMPONENT_IN_USE",
      "Archive dependent components and deployments before archiving the component",
    );
  }
  await components.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: "active",
    },
    { $set: archiveFields(actor) },
  );
  return getComponent(current.id);
}

export async function restoreComponent(componentId, actor = {}) {
  const current = await getComponent(componentId);
  if (!current) {
    throw createCatalogError(404, "COMPONENT_NOT_FOUND", "Component not found");
  }
  if (current.status !== "archived") return current;
  await requireOperationalApplication(current.applicationId, {
    workspaceId: current.workspaceId,
    active: true,
  });
  const { components } = await getTopologyCollections();
  await components.updateOne(
    { id: current.id, workspaceId: current.workspaceId, status: "archived" },
    {
      $set: {
        status: "active",
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
      $unset: { archivedAt: "", archivedBy: "" },
    },
  );
  return getComponent(current.id);
}

export async function deleteComponent(componentId) {
  const current = await getComponent(componentId);
  if (!current) {
    throw createCatalogError(404, "COMPONENT_NOT_FOUND", "Component not found");
  }
  if (current.status !== "archived") {
    throw createCatalogError(
      409,
      "COMPONENT_NOT_ARCHIVED",
      "Only archived components can be permanently deleted",
    );
  }
  const { components, deployments, db } = await getTopologyCollections();
  const scope = {
    workspaceId: current.workspaceId,
    applicationId: current.applicationId,
  };
  const counts = await Promise.all([
    components.countDocuments(
      { ...scope, "dependencies.componentId": current.id },
      { limit: 1 },
    ),
    deployments.countDocuments(
      { ...scope, componentId: current.id },
      { limit: 1 },
    ),
    db
      .collection(COLLECTION_NAMES.DOCUMENTS)
      .countDocuments(
        { ...scope, affectedComponentIds: current.id },
        { limit: 1 },
      ),
    db
      .collection(COLLECTION_NAMES.ISSUES)
      .countDocuments(
        { ...scope, affectedComponentIds: current.id },
        { limit: 1 },
      ),
    db
      .collection(COLLECTION_NAMES.REQUESTS)
      .countDocuments(
        { ...scope, affectedComponentIds: current.id },
        { limit: 1 },
      ),
  ]);
  if (counts.some(Boolean)) {
    throw createCatalogError(
      409,
      "COMPONENT_HAS_DEPENDENCIES",
      "Remova as dependências antes de excluir o componente",
    );
  }
  const result = await components.deleteOne({
    id: current.id,
    ...scope,
    status: "archived",
  });
  if (!result.deletedCount)
    throw createCatalogError(
      409,
      "COMPONENT_DELETE_CONFLICT",
      "Component was not deleted",
    );
  return current;
}
