import { textValue } from "../../../helpers/text.js";
import type { RepositoryQuery } from "../../../types/http.js";
import type { RuntimeDocument, ComponentDocument, DeploymentDocument } from "../../../types/topology.js";
import type { Filter } from "mongodb";
import { getDeployment } from "../queries.js";
import { findByReference } from "../../../helpers/referenceLookup.js";
import { buildKnowledgeContextFilter } from "../../shared/knowledgeContext.js";
import { RUNTIME_KINDS, RUNTIME_STATUSES } from "../../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { buildScopedListFilter, pagination } from "../../shared/topology/filters.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { getTopologyCollections } from "../../shared/topology/storage.js";
import { normalizeDocument, normalizeEnum } from "../../shared/topology/normalization.js";
import { getApplicationByKey } from "../../catalog/applications/queries.js";

export async function listRuntimes(deploymentId: string | string[], query: RepositoryQuery = {}) {
  const deployment = await getDeployment(deploymentId);
  if (!deployment) {
    throw createCatalogError(404, "DEPLOYMENT_NOT_FOUND", "Deployment not found");
  }
  const { db, runtimes } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: deployment.workspaceId,
    applicationId: deployment.applicationId,
    statuses: RUNTIME_STATUSES,
    query,
    searchFields: ["key", "name", "endpoint", "namespace", "runtimeName"],
  });
  filter.deploymentId = deployment.id;
  if (textValue(query.monitoredOnly || "").toLowerCase() === "true") {
    const monitoredRuntimeIds = await db.collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS).distinct("runtimeId", {
      workspaceId: deployment.workspaceId,
      applicationId: deployment.applicationId,
      deploymentId: deployment.id,
      archivedAt: { $exists: false },
    });
    filter.id = { $in: monitoredRuntimeIds };
  }
  if (query.serverId) filter.serverId = textValue(query.serverId);
  if (query.kind) {
    filter.kind = normalizeEnum(query.kind, "kind", RUNTIME_KINDS);
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    runtimes.find(filter).sort({ name: 1, id: 1 }).skip(skip).limit(limit).toArray(),
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
    items: documents.map((document) => normalizeDocument(document) as RuntimeDocument),
  };
}

export async function getRuntime(
  runtimeId: string | string[],
  { deploymentId, workspaceId }: { deploymentId?: string; workspaceId?: string } = {},
) {
  const { runtimes } = await getTopologyCollections();
  const filter: Filter<RuntimeDocument> = { id: String(runtimeId) };
  if (deploymentId) filter.deploymentId = String(deploymentId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const runtime = normalizeDocument(await runtimes.findOne(filter)) as RuntimeDocument | null;
  if (!runtime) return null;
  const deployment = await getDeployment(runtime.deploymentId, {
    applicationId: runtime.applicationId,
  });
  if (deployment?.workspaceId !== runtime.workspaceId || deployment.componentId !== runtime.componentId) {
    return null;
  }
  return runtime;
}

export async function getRuntimeByReference(
  runtimeReference: string | string[],
  { workspaceId, authorizationScope }: Pick<RepositoryQuery, "workspaceId" | "authorizationScope"> = {},
) {
  const reference = String(runtimeReference || "").trim();
  const { runtimes: referenceRuntimes } = await getTopologyCollections();
  const direct = await findByReference(referenceRuntimes, reference, {
    identifierField: "key",
    lowercase: true,
    filter: buildKnowledgeContextFilter({
      workspaceId,
      authorizationScope,
    }) as Filter<RuntimeDocument>,
  });
  if (direct) return getRuntime(direct.id, { workspaceId });
  const segments = reference.split(".");
  if (segments.length === 1) return null;
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
  ) as ComponentDocument | null;
  if (!component) return null;

  const deployment = normalizeDocument(
    await deployments.findOne({
      workspaceId: application.workspaceId,
      applicationId: application.id,
      componentId: component.id,
      key: deploymentKey,
    }),
  ) as DeploymentDocument | null;
  if (!deployment) return null;

  const runtime = normalizeDocument(
    await runtimes.findOne({
      workspaceId: application.workspaceId,
      applicationId: application.id,
      deploymentId: deployment.id,
      key: runtimeKey,
    }),
  ) as RuntimeDocument | null;
  return runtime ? getRuntime(runtime.id, { workspaceId }) : null;
}
