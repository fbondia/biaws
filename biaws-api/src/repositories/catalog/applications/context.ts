import type { RepositoryQuery } from "../../../types/http.js";
import type { Document, WithId } from "mongodb";
import type {
  ComponentDocument,
  RepositoryDocument,
  DeploymentDocument,
  RuntimeDocument,
  ServerDocument,
} from "../../../types/topology.js";
import { isRecord } from "../../../helpers/records.js";
import {
  CATALOG_LIMITS,
  DEFAULT_MONITORING_RETENTION_DAYS,
} from "../../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { getTopologyCollections } from "../../shared/topology/storage.js";
import { normalizeDocument } from "../../shared/topology/normalization.js";
import { requireOperationalApplication } from "../../shared/topology/context.js";
import { listIntegrations } from "../../integrations/queries.js";

function readContextLimit(query: RepositoryQuery = {}) {
  const value = Number(query.limit ?? 25);
  if (!Number.isInteger(value) || value < 1) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAGINATION",
      "limit must be a positive integer",
    );
  }
  return Math.min(value, CATALOG_LIMITS.contextItemsPerCollection);
}

function omitArchivedFilter(query: RepositoryQuery) {
  return String(query.includeArchived || "").toLowerCase() === "true"
    ? {}
    : { status: { $ne: "archived" } };
}

function componentSummary(document: WithId<ComponentDocument>) {
  return {
    id: document.id,
    key: document.key,
    name: document.name,
    type: document.type,
    status: document.status,
    repositoryLinks: document.repositoryLinks,
    dependencies: document.dependencies,
    tags: document.tags,
    updatedAt: document.updatedAt,
  };
}

function repositorySummary(document: WithId<RepositoryDocument>) {
  return {
    id: document.id,
    key: document.key,
    name: document.name,
    provider: document.provider,
    organization: document.organization,
    url: document.url,
    defaultBranch: document.defaultBranch,
    status: document.status,
    sync: document.sync,
    updatedAt: document.updatedAt,
  };
}

function integrationSummary(document: unknown) {
  const item = isRecord(document) ? document : {};
  return {
    id: item.id,
    key: item.key,
    name: item.name,
    description: item.description,
    targetApplicationId: item.targetApplicationId,
    status: item.status,
    updatedAt: item.updatedAt,
  };
}

function deploymentSummary(document: WithId<DeploymentDocument>) {
  return {
    id: document.id,
    key: document.key,
    name: document.name,
    componentId: document.componentId,
    environment: document.environment,
    repositoryId:
      document.repositoryId || document.source?.repositoryId || null,
    publications: document.publications || [],
    version: document.version,
    source: document.source,
    status: document.status,
    deployedAt: document.deployedAt,
    updatedAt: document.updatedAt,
  };
}

function runtimeSummary(document: WithId<RuntimeDocument>) {
  return {
    id: document.id,
    key: document.key,
    name: document.name,
    deploymentId: document.deploymentId,
    componentId: document.componentId,
    kind: document.kind,
    serverId: document.serverId,
    endpoint: document.endpoint,
    port: document.port,
    namespace: document.namespace,
    runtimeName: document.runtimeName,
    status: document.status,
    monitoringRetentionDays:
      document.monitoringRetentionDays ?? DEFAULT_MONITORING_RETENTION_DAYS,
    observedAt: document.observedAt,
    documentLinks: document.documentLinks || [],
    operationalNotesMarkdown: document.operationalNotesMarkdown || "",
    updatedAt: document.updatedAt,
  };
}

function serverSummary(document: WithId<ServerDocument>) {
  return {
    id: document.id,
    key: document.key,
    name: document.name,
    provider: document.provider,
    location: document.location,
    operatingSystem: document.operatingSystem,
    status: document.status,
    tags: document.tags,
    updatedAt: document.updatedAt,
  };
}

function issueSummary(document: WithId<Document>) {
  return {
    id: document.id,
    title: document.title,
    type: document.type,
    status: document.status,
    affectedComponentIds: document.affectedComponentIds || [],
    classification: document.classification || null,
    dates: document.dates || {},
    updatedAt: document.updatedAt,
  };
}

function demandSummary(document: WithId<Document>) {
  return {
    id: document._id?.toString?.() ?? String(document._id),
    clientCode: document.clientCode || "",
    title: document.title,
    status: document.status,
    affectedComponentIds: document.affectedComponentIds || [],
    estimatedDeliveryDate: document.estimatedDeliveryDate || "",
    updatedAt: document.updatedAt,
  };
}

function knowledgeRecordSummary(document: Document) {
  return {
    id: document.id,
    documentType: document.documentType,
    title: document.title,
    summary: document.summary,
    status: document.status,
    affectedComponentIds: document.affectedComponentIds || [],
    references: document.references || [],
    definedAt: document.definedAt || "",
    lastReviewedAt: document.lastReviewedAt || "",
    nextReviewAt: document.nextReviewAt || "",
    classification: document.classification || null,
    attachments: document.attachments || [],
    updatedAt: document.updatedAt,
  };
}

export async function getApplicationContext(
  applicationId: string | string[],
  query: RepositoryQuery = {},
) {
  const application = await requireOperationalApplication(applicationId);
  const limit = readContextLimit(query);
  const statusFilter = omitArchivedFilter(query);
  const scope = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
    ...statusFilter,
  };
  const { db, components, repositories, deployments, runtimes, servers } =
    await getTopologyCollections();
  const knowledgeScope = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
  };
  const issues = db.collection(COLLECTION_NAMES.ISSUES);
  const demands = db.collection(COLLECTION_NAMES.REQUESTS);
  const documents = db.collection(COLLECTION_NAMES.DOCUMENTS);
  const includeHistoricalKnowledge =
    String(query.includeArchived || "").toLowerCase() === "true";
  const documentScope = {
    workspaceId: application.workspaceId,
    applicationId: { $in: [application.id, null] },
    ...(includeHistoricalKnowledge
      ? {}
      : {
          $or: [
            { documentType: "business-rule", status: "active" },
            { documentType: "architecture-decision", status: "accepted" },
            {
              documentType: {
                $in: [
                  "guideline",
                  "feature",
                  "technical-reference",
                  "procedure",
                ],
              },
              status: "published",
            },
          ],
        }),
  };

  const [
    componentDocuments,
    repositoryDocuments,
    deploymentDocuments,
    runtimeDocuments,
    componentTotal,
    repositoryTotal,
    deploymentTotal,
    runtimeTotal,
    issueDocuments,
    demandDocuments,
    issueTotal,
    demandTotal,
    documentDocuments,
    documentTotal,
    integrationResult,
  ] = await Promise.all([
    components.find(scope).sort({ name: 1, id: 1 }).limit(limit).toArray(),
    repositories.find(scope).sort({ name: 1, id: 1 }).limit(limit).toArray(),
    deployments
      .find(scope)
      .sort({ deployedAt: -1, id: 1 })
      .limit(limit)
      .toArray(),
    runtimes.find(scope).sort({ name: 1, id: 1 }).limit(limit).toArray(),
    components.countDocuments(scope),
    repositories.countDocuments(scope),
    deployments.countDocuments(scope),
    runtimes.countDocuments(scope),
    issues
      .find(knowledgeScope)
      .sort({ updatedAt: -1, id: 1 })
      .limit(limit)
      .toArray(),
    demands
      .find(knowledgeScope)
      .sort({ updatedAt: -1, _id: 1 })
      .limit(limit)
      .toArray(),
    issues.countDocuments(knowledgeScope),
    demands.countDocuments(knowledgeScope),
    documents
      .find(documentScope)
      .project({ markdown: 0 })
      .sort({ updatedAt: -1, id: 1 })
      .limit(limit)
      .toArray(),
    documents.countDocuments(documentScope),
    listIntegrations(application.id, {
      includeArchived: query.includeArchived,
      limit,
    }),
  ]);

  const serverIds = [
    ...new Set(
      runtimeDocuments
        .map(({ serverId }) => serverId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const serverFilter = {
    workspaceId: application.workspaceId,
    id: { $in: serverIds },
    ...statusFilter,
  };
  const [serverDocuments, serverTotal] = serverIds.length
    ? await Promise.all([
        servers
          .find(serverFilter)
          .sort({ name: 1, id: 1 })
          .limit(limit)
          .toArray(),
        servers.countDocuments(serverFilter),
      ])
    : [[], 0];

  return {
    application: normalizeDocument(application),
    meta: {
      workspaceId: application.workspaceId,
      limitPerCollection: limit,
      includeArchived:
        String(query.includeArchived || "").toLowerCase() === "true",
      totals: {
        components: componentTotal,
        repositories: repositoryTotal,
        deployments: deploymentTotal,
        runtimes: runtimeTotal,
        referencedServers: serverTotal,
        issues: issueTotal,
        demands: demandTotal,
        documents: documentTotal,
        integrations: integrationResult.meta.total,
      },
      truncated: {
        components: componentTotal > componentDocuments.length,
        repositories: repositoryTotal > repositoryDocuments.length,
        deployments: deploymentTotal > deploymentDocuments.length,
        runtimes: runtimeTotal > runtimeDocuments.length,
        referencedServers: serverTotal > serverDocuments.length,
        issues: issueTotal > issueDocuments.length,
        demands: demandTotal > demandDocuments.length,
        documents: documentTotal > documentDocuments.length,
        integrations:
          integrationResult.meta.total > integrationResult.items.length,
      },
    },
    components: componentDocuments.map(componentSummary),
    integrations: integrationResult.items.map(integrationSummary),
    repositories: repositoryDocuments.map(repositorySummary),
    deployments: deploymentDocuments.map(deploymentSummary),
    runtimes: runtimeDocuments.map(runtimeSummary),
    servers: serverDocuments.map(serverSummary),
    issues: issueDocuments.map(issueSummary),
    demands: demandDocuments.map(demandSummary),
    documents: documentDocuments.map(knowledgeRecordSummary),
  };
}
