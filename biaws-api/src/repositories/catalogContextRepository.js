import {
  CATALOG_LIMITS,
  DEFAULT_MONITORING_RETENTION_DAYS,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import {
  createCatalogError,
  getTopologyCollections,
  normalizeDocument,
  requireOperationalApplication,
} from "./topologyRepositorySupport.js";
import { listIntegrations } from "./integrationsRepository.js";

function readContextLimit(query = {}) {
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

function omitArchivedFilter(query) {
  return String(query.includeArchived || "").toLowerCase() === "true"
    ? {}
    : { status: { $ne: "archived" } };
}

function componentSummary(document) {
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

function repositorySummary(document) {
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

function integrationSummary(document) {
  return {
    id: document.id,
    key: document.key,
    name: document.name,
    description: document.description,
    targetApplicationId: document.targetApplicationId,
    status: document.status,
    updatedAt: document.updatedAt,
  };
}

function deploymentSummary(document) {
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

function runtimeSummary(document) {
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
    procedureIds: document.procedureIds || [],
    procedureMarkdown: document.procedureMarkdown || "",
    updatedAt: document.updatedAt,
  };
}

function serverSummary(document) {
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

function issueSummary(document) {
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

function demandSummary(document) {
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

function procedureSummary(document) {
  return {
    id: document.id,
    title: document.title,
    summary: document.summary,
    affectedComponentIds: document.affectedComponentIds || [],
    classification: document.classification || null,
    updatedAt: document.updatedAt,
  };
}

function knowledgeRecordSummary(document) {
  return {
    id: document.id,
    title: document.title,
    status: document.status,
    affectedComponentIds: document.affectedComponentIds || [],
    references: document.references || [],
    definedAt: document.definedAt || "",
    lastReviewedAt: document.lastReviewedAt || "",
    nextReviewAt: document.nextReviewAt || "",
    updatedAt: document.updatedAt,
  };
}

export async function getApplicationContext(applicationId, query = {}) {
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
  const procedures = db.collection(COLLECTION_NAMES.PROCEDURES);
  const businessRules = db.collection(COLLECTION_NAMES.BUSINESS_RULES);
  const architectureDecisions = db.collection(
    COLLECTION_NAMES.ARCHITECTURE_DECISIONS,
  );
  const includeHistoricalKnowledge =
    String(query.includeArchived || "").toLowerCase() === "true";
  const businessRuleScope = {
    ...knowledgeScope,
    ...(includeHistoricalKnowledge ? {} : { status: "active" }),
  };
  const architectureDecisionScope = {
    ...knowledgeScope,
    ...(includeHistoricalKnowledge ? {} : { status: "accepted" }),
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
    procedureDocuments,
    issueTotal,
    demandTotal,
    procedureTotal,
    businessRuleDocuments,
    architectureDecisionDocuments,
    businessRuleTotal,
    architectureDecisionTotal,
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
    procedures
      .find(knowledgeScope)
      .sort({ updatedAt: -1, id: 1 })
      .limit(limit)
      .toArray(),
    issues.countDocuments(knowledgeScope),
    demands.countDocuments(knowledgeScope),
    procedures.countDocuments(knowledgeScope),
    businessRules
      .find(businessRuleScope)
      .project({ markdown: 0 })
      .sort({ updatedAt: -1, id: 1 })
      .limit(limit)
      .toArray(),
    architectureDecisions
      .find(architectureDecisionScope)
      .project({ markdown: 0 })
      .sort({ updatedAt: -1, id: 1 })
      .limit(limit)
      .toArray(),
    businessRules.countDocuments(businessRuleScope),
    architectureDecisions.countDocuments(architectureDecisionScope),
    listIntegrations(application.id, {
      includeArchived: query.includeArchived,
      limit,
    }),
  ]);

  const serverIds = [
    ...new Set(
      runtimeDocuments.map(({ serverId }) => serverId).filter(Boolean),
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
        procedures: procedureTotal,
        businessRules: businessRuleTotal,
        architectureDecisions: architectureDecisionTotal,
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
        procedures: procedureTotal > procedureDocuments.length,
        businessRules: businessRuleTotal > businessRuleDocuments.length,
        architectureDecisions:
          architectureDecisionTotal > architectureDecisionDocuments.length,
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
    procedures: procedureDocuments.map(procedureSummary),
    businessRules: businessRuleDocuments.map(knowledgeRecordSummary),
    architectureDecisions: architectureDecisionDocuments.map(
      knowledgeRecordSummary,
    ),
  };
}
