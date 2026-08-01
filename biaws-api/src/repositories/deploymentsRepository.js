import { randomUUID } from "node:crypto";

import {
  CATALOG_LIMITS,
  DEFAULT_MONITORING_RETENTION_DAYS,
  DEPLOYMENT_ENVIRONMENTS,
  DEPLOYMENT_STATUSES,
  RUNTIME_KINDS,
  RUNTIME_STATUSES,
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
  normalizeDate,
  normalizeDocument,
  normalizeEnum,
  normalizeHttpUrl,
  normalizeKey,
  normalizeMetadata,
  normalizeOptionalPort,
  optionalText,
  pagination,
  requiredText,
  requireOperationalApplication,
} from "./topologyRepositorySupport.js";
import { assertNoActiveApplicationIntegrations } from "./integrationsRepository.js";
import { getApplicationByKey } from "./catalogRepository.js";

const MUTABLE_DEPLOYMENT_STATUSES = DEPLOYMENT_STATUSES.filter(
  (status) => status !== "archived",
);
const MUTABLE_RUNTIME_STATUSES = RUNTIME_STATUSES.filter(
  (status) => status !== "archived",
);
const MAX_HISTORY_ITEMS = 200;
const MAX_PROCEDURE_LENGTH = 20_000;

function normalizeMonitoringRetentionDays(value, current) {
  const fallback =
    current?.monitoringRetentionDays ?? DEFAULT_MONITORING_RETENTION_DAYS;
  if (value === undefined || value === null || value === "") return fallback;
  const days = Number(value);
  if (
    !Number.isInteger(days) ||
    days < 0 ||
    days > CATALOG_LIMITS.monitoringRetentionDays
  ) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_RETENTION",
      `monitoringRetentionDays must be an integer between 0 and ${CATALOG_LIMITS.monitoringRetentionDays}`,
    );
  }
  return days;
}

function legacyPublications(current) {
  if (Array.isArray(current?.publications)) return current.publications;
  if (!current?.version && !current?.source?.revision && !current?.deployedAt) {
    return [];
  }
  return [
    {
      id: `legacy-${current.id || "publication"}`,
      version: current.version || "Versão não informada",
      revision: current.source?.revision || "",
      repositoryId: current.source?.repositoryId || null,
      publishedAt: current.deployedAt || current.updatedAt || current.createdAt,
      description: "",
      recordedAt: current.updatedAt || current.createdAt,
      recordedBy: current.updatedBy || current.createdBy || "system",
    },
  ];
}

function normalizeAppendOnlyHistory({
  actor,
  current = [],
  field,
  normalizeItem,
  value,
}) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > MAX_HISTORY_ITEMS) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must be an array with at most ${MAX_HISTORY_ITEMS} items`,
    );
  }
  if (
    value.length < current.length ||
    current.some((item, index) => value[index]?.id !== item.id)
  ) {
    throw createCatalogError(
      409,
      "CATALOG_HISTORY_IMMUTABLE",
      `${field} entries cannot be changed or removed`,
    );
  }
  return [
    ...current,
    ...value.slice(current.length).map((item, index) =>
      normalizeItem(item, current.length + index, {
        actor,
        id: randomUUID(),
        recordedAt: new Date(),
      }),
    ),
  ];
}

function normalizePublication(item, index, context) {
  assertAllowedFields(
    item,
    [
      "id",
      "version",
      "revision",
      "repositoryId",
      "publishedAt",
      "description",
      "recordedAt",
      "recordedBy",
    ],
    `publications[${index}]`,
  );
  return {
    id: context.id,
    version: requiredText(
      item.version,
      `publications[${index}].version`,
      CATALOG_LIMITS.version,
    ),
    revision: optionalText(
      item.revision,
      `publications[${index}].revision`,
      CATALOG_LIMITS.revision,
    ),
    repositoryId:
      optionalText(
        item.repositoryId,
        `publications[${index}].repositoryId`,
        100,
      ) || null,
    publishedAt:
      normalizeDate(item.publishedAt, `publications[${index}].publishedAt`) ||
      context.recordedAt,
    description: optionalText(
      item.description,
      `publications[${index}].description`,
      CATALOG_LIMITS.description,
    ),
    recordedAt: context.recordedAt,
    recordedBy: actorId(context.actor),
  };
}

function normalizeSource(value, current = {}) {
  if (value === undefined) {
    return {
      repositoryId: current.repositoryId || null,
      revision: current.revision || "",
    };
  }
  if (value === null) return { repositoryId: null, revision: "" };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_SOURCE",
      "source must be an object or null",
    );
  }
  assertAllowedFields(value, ["repositoryId", "revision"], "source");
  const repositoryId =
    value.repositoryId === null || value.repositoryId === ""
      ? null
      : optionalText(
          value.repositoryId ?? current.repositoryId,
          "source.repositoryId",
          100,
        ) || null;
  const revision = optionalText(
    value.revision ?? current.revision,
    "source.revision",
    CATALOG_LIMITS.revision,
  );
  if (revision && !repositoryId) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_SOURCE",
      "source.repositoryId is required when source.revision is provided",
    );
  }
  return { repositoryId, revision };
}

export function normalizeDeploymentInput(
  payload = {},
  current = null,
  actor = {},
) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "componentId",
      "environment",
      "repositoryId",
      "publications",
      "version",
      "source",
      "status",
      "deployedAt",
    ],
    "deployment",
  );
  const componentId = requiredText(
    payload.componentId ?? current?.componentId,
    "componentId",
    100,
  );
  if (current && componentId !== current.componentId) {
    throw createCatalogError(
      409,
      "DEPLOYMENT_COMPONENT_IMMUTABLE",
      "deployment component cannot be changed",
    );
  }
  const repositoryId =
    optionalText(
      payload.repositoryId ??
        current?.repositoryId ??
        payload.source?.repositoryId ??
        current?.source?.repositoryId,
      "repositoryId",
      100,
    ) || null;
  const publications = normalizeAppendOnlyHistory({
    actor,
    current: legacyPublications(current),
    field: "publications",
    normalizeItem: (item, index, context) =>
      normalizePublication(
        { ...item, repositoryId: item.repositoryId || repositoryId },
        index,
        context,
      ),
    value: payload.publications,
  });
  const latestPublication = publications.at(-1);
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(
      payload.name ?? current?.name,
      "name",
      CATALOG_LIMITS.name,
    ),
    componentId,
    environment: normalizeEnum(
      payload.environment,
      "environment",
      DEPLOYMENT_ENVIRONMENTS,
      current?.environment || "other",
    ),
    repositoryId,
    publications,
    version:
      latestPublication?.version ||
      optionalText(payload.version ?? current?.version, "version"),
    source: {
      repositoryId,
      revision:
        latestPublication?.revision ||
        normalizeSource(payload.source, current?.source).revision,
    },
    status: normalizeEnum(
      payload.status,
      "status",
      MUTABLE_DEPLOYMENT_STATUSES,
      current?.status || "planned",
    ),
    deployedAt:
      latestPublication?.publishedAt ||
      normalizeDate(payload.deployedAt, "deployedAt", current?.deployedAt),
  };
}

async function validateDeploymentRelationships(application, deployment) {
  const { components, repositories } = await getTopologyCollections();
  const publicationRepositoryIds = [
    ...new Set(
      (deployment.publications || [])
        .map(({ repositoryId }) => repositoryId)
        .filter(Boolean),
    ),
  ];
  const [component, repository, publicationRepositoryCount] = await Promise.all(
    [
      components.findOne({
        id: deployment.componentId,
        workspaceId: application.workspaceId,
        applicationId: application.id,
        status: "active",
      }),
      deployment.repositoryId
        ? repositories.findOne({
            id: deployment.repositoryId,
            workspaceId: application.workspaceId,
            applicationId: application.id,
            status: "active",
          })
        : null,
      publicationRepositoryIds.length
        ? repositories.countDocuments({
            id: { $in: publicationRepositoryIds },
            workspaceId: application.workspaceId,
            applicationId: application.id,
          })
        : 0,
    ],
  );
  if (!component) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_COMPONENT",
      "component must be active and belong to the application",
    );
  }
  if (deployment.repositoryId && !repository) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_REPOSITORY",
      "source repository must be active and belong to the application",
    );
  }
  if (publicationRepositoryCount !== publicationRepositoryIds.length) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_PUBLICATION_REPOSITORY",
      "publication repositories must belong to the deployment application",
    );
  }
}

export async function listDeployments(applicationId, query = {}) {
  const application = await requireOperationalApplication(applicationId);
  const { deployments, runtimes } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: application.workspaceId,
    applicationId: application.id,
    statuses: DEPLOYMENT_STATUSES,
    query,
    searchFields: ["key", "name", "environment", "version", "source.revision"],
  });
  if (query.componentId) filter.componentId = String(query.componentId);
  if (query.repositoryId) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { repositoryId: String(query.repositoryId) },
          { "source.repositoryId": String(query.repositoryId) },
        ],
      },
    ];
  }
  if (query.environment) {
    filter.environment = normalizeEnum(
      query.environment,
      "environment",
      DEPLOYMENT_ENVIRONMENTS,
    );
  }
  if (query.serverId) {
    const deploymentIds = await runtimes.distinct("deploymentId", {
      workspaceId: application.workspaceId,
      applicationId: application.id,
      serverId: String(query.serverId),
      ...(String(query.includeArchived || "").toLowerCase() === "true"
        ? {}
        : { status: { $ne: "archived" } }),
    });
    filter.id = { $in: deploymentIds };
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    deployments
      .find(filter)
      .sort({ deployedAt: -1, name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    deployments.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.APPLICATION_DEPLOYMENTS,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map(normalizeDocument),
  };
}

export async function getDeployment(
  deploymentId,
  { applicationId, workspaceId } = {},
) {
  const { deployments } = await getTopologyCollections();
  const filter = { id: String(deploymentId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const deployment = normalizeDocument(await deployments.findOne(filter));
  if (!deployment) return null;
  await requireOperationalApplication(deployment.applicationId, {
    workspaceId: deployment.workspaceId,
  });
  return deployment;
}

export async function createDeployment(
  applicationId,
  payload = {},
  actor = {},
) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const normalized = normalizeDeploymentInput(payload, null, actor);
  await validateDeploymentRelationships(application, normalized);
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
  const { deployments } = await getTopologyCollections();
  try {
    await deployments.insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "DEPLOYMENT_KEY_CONFLICT",
      "A deployment with this key already exists in the application",
    );
  }
  return normalizeDocument(document);
}

export async function updateDeployment(deploymentId, payload = {}, actor = {}) {
  const current = await getDeployment(deploymentId);
  if (!current) {
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  }
  if (current.status === "archived") {
    throw createCatalogError(
      409,
      "DEPLOYMENT_ARCHIVED",
      "Deployment is archived",
    );
  }
  const application = await requireOperationalApplication(
    current.applicationId,
    {
      active: true,
      workspaceId: current.workspaceId,
    },
  );
  const normalized = normalizeDeploymentInput(payload, current, actor);
  await validateDeploymentRelationships(application, normalized);
  const { deployments } = await getTopologyCollections();
  let result;
  try {
    result = await deployments.updateOne(
      {
        id: current.id,
        workspaceId: current.workspaceId,
        applicationId: current.applicationId,
        status: { $ne: "archived" },
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
      "DEPLOYMENT_KEY_CONFLICT",
      "A deployment with this key already exists in the application",
    );
  }
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "DEPLOYMENT_CONCURRENT_UPDATE",
      "Deployment changed concurrently; reload and try again",
    );
  }
  return getDeployment(current.id);
}

export async function archiveDeployment(deploymentId, actor = {}) {
  const current = await getDeployment(deploymentId);
  if (!current) {
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  }
  if (current.status === "archived") return current;
  const { deployments, runtimes } = await getTopologyCollections();
  const activeRuntimes = await runtimes.countDocuments({
    workspaceId: current.workspaceId,
    applicationId: current.applicationId,
    deploymentId: current.id,
    status: { $ne: "archived" },
  });
  if (activeRuntimes) {
    throw createCatalogError(
      409,
      "DEPLOYMENT_IN_USE",
      "Archive all runtimes before archiving the deployment",
    );
  }
  await deployments.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: { $ne: "archived" },
    },
    { $set: archiveFields(actor) },
  );
  return getDeployment(current.id);
}

export function normalizeRuntimeInput(
  payload = {},
  current = null,
  actor = {},
) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "kind",
      "serverId",
      "endpoint",
      "port",
      "namespace",
      "runtimeName",
      "status",
      "metadata",
      "monitoringRetentionDays",
      "observedAt",
      "procedureMarkdown",
    ],
    "runtime",
  );
  const rawServerId =
    payload.serverId === undefined ? current?.serverId : payload.serverId;
  const serverId =
    rawServerId === null || rawServerId === ""
      ? null
      : optionalText(rawServerId, "serverId", 100) || null;
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(
      payload.name ?? current?.name,
      "name",
      CATALOG_LIMITS.name,
    ),
    kind: normalizeEnum(
      payload.kind,
      "kind",
      RUNTIME_KINDS,
      current?.kind || "other",
    ),
    serverId,
    endpoint: normalizeHttpUrl(payload.endpoint, "endpoint", {
      current: current?.endpoint,
    }),
    port: normalizeOptionalPort(payload.port, current?.port),
    namespace: optionalText(
      payload.namespace ?? current?.namespace,
      "namespace",
      CATALOG_LIMITS.namespace,
    ),
    runtimeName: optionalText(
      payload.runtimeName ?? current?.runtimeName,
      "runtimeName",
      CATALOG_LIMITS.runtimeName,
    ),
    status: normalizeEnum(
      payload.status,
      "status",
      MUTABLE_RUNTIME_STATUSES,
      current?.status || "unknown",
    ),
    metadata: normalizeMetadata(payload.metadata, current?.metadata),
    monitoringRetentionDays: normalizeMonitoringRetentionDays(
      payload.monitoringRetentionDays,
      current,
    ),
    observedAt: normalizeDate(
      payload.observedAt,
      "observedAt",
      current?.observedAt,
    ),
    procedureMarkdown: optionalText(
      payload.procedureMarkdown ?? current?.procedureMarkdown,
      "procedureMarkdown",
      MAX_PROCEDURE_LENGTH,
    ),
  };
}

async function validateRuntimeServer(deployment, runtime) {
  if (!runtime.serverId) return;
  const { servers } = await getTopologyCollections();
  const server = await servers.findOne({
    id: runtime.serverId,
    workspaceId: deployment.workspaceId,
    status: { $ne: "archived" },
  });
  if (!server) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_SERVER",
      "server must be non-archived and belong to the deployment workspace",
    );
  }
}

export async function listRuntimes(deploymentId, query = {}) {
  const deployment = await getDeployment(deploymentId);
  if (!deployment) {
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  }
  const { runtimes } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: deployment.workspaceId,
    applicationId: deployment.applicationId,
    statuses: RUNTIME_STATUSES,
    query,
    searchFields: ["key", "name", "endpoint", "namespace", "runtimeName"],
  });
  filter.deploymentId = deployment.id;
  if (query.serverId) filter.serverId = String(query.serverId);
  if (query.kind) {
    filter.kind = normalizeEnum(query.kind, "kind", RUNTIME_KINDS);
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    runtimes
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    runtimes.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.DEPLOYMENT_RUNTIMES,
      workspaceId: deployment.workspaceId,
      applicationId: deployment.applicationId,
      deploymentId: deployment.id,
      total,
      page,
      limit,
    },
    items: documents.map(normalizeDocument),
  };
}

export async function getRuntime(
  runtimeId,
  { deploymentId, workspaceId } = {},
) {
  const { runtimes } = await getTopologyCollections();
  const filter = { id: String(runtimeId) };
  if (deploymentId) filter.deploymentId = String(deploymentId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const runtime = normalizeDocument(await runtimes.findOne(filter));
  if (!runtime) return null;
  const deployment = await getDeployment(runtime.deploymentId, {
    applicationId: runtime.applicationId,
  });
  if (
    !deployment ||
    deployment.workspaceId !== runtime.workspaceId ||
    deployment.componentId !== runtime.componentId
  ) {
    return null;
  }
  return runtime;
}

export async function getRuntimeByReference(
  runtimeReference,
  { workspaceId } = {},
) {
  const reference = String(runtimeReference || "").trim();
  const segments = reference.split(".");
  if (segments.length === 1) return getRuntime(reference, { workspaceId });
  if (segments.length !== 4 || segments.some((segment) => !segment)) {
    return null;
  }

  const [applicationKey, componentKey, deploymentKey, runtimeKey] = segments;
  const application = await getApplicationByKey(applicationKey, {
    workspaceId,
  });
  if (!application) return null;

  const { components, deployments, runtimes } = await getTopologyCollections();
  const component = normalizeDocument(
    await components.findOne({
      workspaceId: application.workspaceId,
      applicationId: application.id,
      key: componentKey,
    }),
  );
  if (!component) return null;

  const deployment = normalizeDocument(
    await deployments.findOne({
      workspaceId: application.workspaceId,
      applicationId: application.id,
      componentId: component.id,
      key: deploymentKey,
    }),
  );
  if (!deployment) return null;

  const runtime = normalizeDocument(
    await runtimes.findOne({
      workspaceId: application.workspaceId,
      applicationId: application.id,
      deploymentId: deployment.id,
      key: runtimeKey,
    }),
  );
  return runtime ? getRuntime(runtime.id, { workspaceId }) : null;
}

export async function createRuntime(deploymentId, payload = {}, actor = {}) {
  const deployment = await getDeployment(deploymentId);
  if (!deployment) {
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  }
  if (deployment.status === "archived") {
    throw createCatalogError(
      409,
      "DEPLOYMENT_ARCHIVED",
      "Deployment is archived",
    );
  }
  await requireOperationalApplication(deployment.applicationId, {
    active: true,
    workspaceId: deployment.workspaceId,
  });
  const normalized = normalizeRuntimeInput(payload, null, actor);
  await validateRuntimeServer(deployment, normalized);
  const document = {
    id: randomUUID(),
    ...createBaseDocument({
      key: normalized.key,
      workspaceId: deployment.workspaceId,
      applicationId: deployment.applicationId,
      actor,
    }),
    deploymentId: deployment.id,
    componentId: deployment.componentId,
    ...normalized,
  };
  const { runtimes } = await getTopologyCollections();
  try {
    await runtimes.insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "RUNTIME_KEY_CONFLICT",
      "A runtime with this key already exists in the deployment",
    );
  }
  return normalizeDocument(document);
}

export async function updateRuntime(runtimeId, payload = {}, actor = {}) {
  const current = await getRuntime(runtimeId);
  if (!current) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  if (current.status === "archived") {
    throw createCatalogError(409, "RUNTIME_ARCHIVED", "Runtime is archived");
  }
  const deployment = await getDeployment(current.deploymentId, {
    applicationId: current.applicationId,
  });
  if (!deployment || deployment.status === "archived") {
    throw createCatalogError(
      409,
      "DEPLOYMENT_ARCHIVED",
      "Deployment is archived",
    );
  }
  await requireOperationalApplication(current.applicationId, {
    active: true,
    workspaceId: current.workspaceId,
  });
  const normalized = normalizeRuntimeInput(payload, current, actor);
  await validateRuntimeServer(deployment, normalized);
  const { runtimes } = await getTopologyCollections();
  let result;
  try {
    result = await runtimes.updateOne(
      {
        id: current.id,
        workspaceId: current.workspaceId,
        applicationId: current.applicationId,
        deploymentId: current.deploymentId,
        status: { $ne: "archived" },
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
      "RUNTIME_KEY_CONFLICT",
      "A runtime with this key already exists in the deployment",
    );
  }
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "RUNTIME_CONCURRENT_UPDATE",
      "Runtime changed concurrently; reload and try again",
    );
  }
  return getRuntime(current.id);
}

export async function archiveRuntime(runtimeId, actor = {}) {
  const current = await getRuntime(runtimeId);
  if (!current) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  if (current.status === "archived") return current;
  const { runtimes } = await getTopologyCollections();
  await runtimes.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      deploymentId: current.deploymentId,
      status: { $ne: "archived" },
    },
    { $set: archiveFields(actor) },
  );
  return getRuntime(current.id);
}

export async function assertApplicationCanArchive(applicationId) {
  const application = await requireOperationalApplication(applicationId);
  await assertNoActiveApplicationIntegrations(
    application.workspaceId,
    application.id,
  );
  const { components, repositories, deployments, runtimes } =
    await getTopologyCollections();
  const scope = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
  };
  const counts = await Promise.all([
    components.countDocuments({ ...scope, status: "active" }),
    repositories.countDocuments({ ...scope, status: "active" }),
    deployments.countDocuments({ ...scope, status: { $ne: "archived" } }),
    runtimes.countDocuments({ ...scope, status: { $ne: "archived" } }),
  ]);
  if (counts.some(Boolean)) {
    throw createCatalogError(
      409,
      "APPLICATION_TOPOLOGY_IN_USE",
      "Archive all application topology resources before archiving the application",
    );
  }
}
