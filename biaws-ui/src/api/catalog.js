import { deleteJson, fetchJson, sendJson } from "./client.js";

export function fetchWorkspaces() {
  return fetchJson("/api/catalog/workspaces");
}

export function fetchWorkspace(workspaceId) {
  return fetchJson(
    `/api/catalog/workspaces/${encodeURIComponent(workspaceId)}`,
  );
}

export function fetchApplications(workspaceId, params) {
  return fetchJson(
    `/api/catalog/workspaces/${encodeURIComponent(workspaceId)}/applications`,
    params,
  );
}

export function fetchApplication(applicationId) {
  return fetchJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}`,
  );
}

export function fetchApplicationContext(applicationId, params) {
  return fetchJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}/context`,
    params,
  );
}

export function createApplication(workspaceId, application) {
  return sendJson(
    `/api/catalog/workspaces/${encodeURIComponent(workspaceId)}/applications`,
    application,
    undefined,
    "POST",
  );
}

export function updateApplication(applicationId, application) {
  return sendJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}`,
    application,
    undefined,
    "PATCH",
  );
}

export function moveApplicationToCollection(applicationId, collectionId) {
  return sendJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}/collection`,
    { collectionId },
    undefined,
    "PATCH",
  );
}

export function archiveApplication(applicationId) {
  return sendJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}/archive`,
    {},
    undefined,
    "PATCH",
  );
}

export function restoreApplication(applicationId) {
  return sendJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}/restore`,
    {},
    undefined,
    "PATCH",
  );
}

export function deleteApplication(applicationId) {
  return deleteJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}/permanent`,
  );
}

function applicationCollection(applicationId, segment, params) {
  return fetchJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}/${segment}`,
    params,
  );
}

function catalogDetail(segment, id) {
  return fetchJson(`/api/catalog/${segment}/${encodeURIComponent(id)}`);
}

function createApplicationEntity(applicationId, segment, entity) {
  return sendJson(
    `/api/catalog/applications/${encodeURIComponent(applicationId)}/${segment}`,
    entity,
    undefined,
    "POST",
  );
}

function updateCatalogEntity(segment, id, entity) {
  return sendJson(
    `/api/catalog/${segment}/${encodeURIComponent(id)}`,
    entity,
    undefined,
    "PATCH",
  );
}

function archiveCatalogEntity(segment, id) {
  return sendJson(
    `/api/catalog/${segment}/${encodeURIComponent(id)}/archive`,
    {},
    undefined,
    "PATCH",
  );
}

function restoreCatalogEntity(segment, id) {
  return sendJson(
    `/api/catalog/${segment}/${encodeURIComponent(id)}/restore`,
    {},
    undefined,
    "PATCH",
  );
}

function deleteCatalogEntity(segment, id) {
  return deleteJson(
    `/api/catalog/${segment}/${encodeURIComponent(id)}/permanent`,
  );
}

export const fetchComponents = (applicationId, params) =>
  applicationCollection(applicationId, "components", params);
export const fetchComponent = (componentId) =>
  catalogDetail("components", componentId);
export const createComponent = (applicationId, component) =>
  createApplicationEntity(applicationId, "components", component);
export const updateComponent = (componentId, component) =>
  updateCatalogEntity("components", componentId, component);
export const archiveComponent = (componentId) =>
  archiveCatalogEntity("components", componentId);
export const restoreComponent = (componentId) =>
  restoreCatalogEntity("components", componentId);
export const deleteComponent = (componentId) =>
  deleteCatalogEntity("components", componentId);

export const fetchIntegrations = (applicationId, params) =>
  applicationCollection(applicationId, "integrations", params);
export const fetchIntegration = (integrationId) =>
  catalogDetail("integrations", integrationId);
export const createIntegration = (applicationId, integration) =>
  createApplicationEntity(applicationId, "integrations", integration);
export const updateIntegration = (integrationId, integration) =>
  updateCatalogEntity("integrations", integrationId, integration);
export const archiveIntegration = (integrationId) =>
  archiveCatalogEntity("integrations", integrationId);
export const restoreIntegration = (integrationId) =>
  restoreCatalogEntity("integrations", integrationId);
export const deleteIntegration = (integrationId) =>
  deleteCatalogEntity("integrations", integrationId);

export const fetchRepositories = (applicationId, params) =>
  applicationCollection(applicationId, "repositories", params);
export const fetchRepository = (repositoryId) =>
  catalogDetail("repositories", repositoryId);
export const createRepository = (applicationId, repository) =>
  createApplicationEntity(applicationId, "repositories", repository);
export const updateRepository = (repositoryId, repository) =>
  updateCatalogEntity("repositories", repositoryId, repository);
export const archiveRepository = (repositoryId) =>
  archiveCatalogEntity("repositories", repositoryId);
export const restoreRepository = (repositoryId) =>
  restoreCatalogEntity("repositories", repositoryId);
export const deleteRepository = (repositoryId) =>
  deleteCatalogEntity("repositories", repositoryId);

export function fetchServers(workspaceId, params) {
  return fetchJson(
    `/api/catalog/workspaces/${encodeURIComponent(workspaceId)}/servers`,
    params,
  );
}

export const fetchServer = (serverId) => catalogDetail("servers", serverId);

export function createServer(workspaceId, server) {
  return sendJson(
    `/api/catalog/workspaces/${encodeURIComponent(workspaceId)}/servers`,
    server,
    undefined,
    "POST",
  );
}

export const updateServer = (serverId, server) =>
  updateCatalogEntity("servers", serverId, server);
export const moveServerToCollection = (serverId, collectionId) =>
  sendJson(
    `/api/catalog/servers/${encodeURIComponent(serverId)}/collection`,
    { collectionId },
    undefined,
    "PATCH",
  );
export const archiveServer = (serverId) =>
  archiveCatalogEntity("servers", serverId);
export const restoreServer = (serverId) =>
  sendJson(
    `/api/catalog/servers/${encodeURIComponent(serverId)}/restore`,
    {},
    undefined,
    "PATCH",
  );
export const deleteServer = (serverId) =>
  deleteJson(`/api/catalog/servers/${encodeURIComponent(serverId)}/permanent`);
export function fetchServerRuntimes(serverId, params) {
  return fetchJson(
    `/api/catalog/servers/${encodeURIComponent(serverId)}/runtimes`,
    params,
  );
}
export function fetchServerDeployments(serverId, params) {
  return fetchJson(
    `/api/catalog/servers/${encodeURIComponent(serverId)}/deployments`,
    params,
  );
}

export const fetchDeployments = (applicationId, params) =>
  applicationCollection(applicationId, "deployments", params);
export const fetchDeployment = (deploymentId) =>
  catalogDetail("deployments", deploymentId);
export const createDeployment = (applicationId, deployment) =>
  createApplicationEntity(applicationId, "deployments", deployment);
export const updateDeployment = (deploymentId, deployment) =>
  updateCatalogEntity("deployments", deploymentId, deployment);
export const archiveDeployment = (deploymentId) =>
  archiveCatalogEntity("deployments", deploymentId);
export const restoreDeployment = (deploymentId) =>
  restoreCatalogEntity("deployments", deploymentId);
export const deleteDeployment = (deploymentId) =>
  deleteCatalogEntity("deployments", deploymentId);

export function fetchRuntimes(deploymentId, params) {
  return fetchJson(
    `/api/catalog/deployments/${encodeURIComponent(deploymentId)}/runtimes`,
    params,
  );
}
export const fetchRuntime = (runtimeId) => catalogDetail("runtimes", runtimeId);
export function createRuntime(deploymentId, runtime) {
  return sendJson(
    `/api/catalog/deployments/${encodeURIComponent(deploymentId)}/runtimes`,
    runtime,
    undefined,
    "POST",
  );
}
export const updateRuntime = (runtimeId, runtime) =>
  updateCatalogEntity("runtimes", runtimeId, runtime);
export const archiveRuntime = (runtimeId) =>
  archiveCatalogEntity("runtimes", runtimeId);
export const restoreRuntime = (runtimeId) =>
  restoreCatalogEntity("runtimes", runtimeId);
export const deleteRuntime = (runtimeId) =>
  deleteCatalogEntity("runtimes", runtimeId);
export function fetchRuntimeMonitoringSignals(runtimeId, params) {
  return fetchJson(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimeId)}/signals`,
    params,
  );
}
export function fetchRuntimeMonitoringTimeline(runtimeId, params) {
  return fetchJson(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimeId)}/timeline`,
    params,
  );
}
export function fetchRuntimeActiveMonitors(runtimeId, params) {
  return fetchJson(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimeId)}/active-monitors`,
    params,
  );
}
export function fetchMonitoredRuntimeTopology() {
  return fetchJson("/api/monitoring/runtime-topology");
}
export function fetchMonitoredRuntimeTargets() {
  return fetchJson("/api/monitoring/runtime-targets");
}
export function createRuntimeActiveMonitor(runtimeId, monitor) {
  return sendJson(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimeId)}/active-monitors`,
    monitor,
    undefined,
    "POST",
  );
}
export function updateRuntimeActiveMonitor(runtimeId, monitorId, monitor) {
  return sendJson(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimeId)}/active-monitors/${encodeURIComponent(monitorId)}`,
    monitor,
    undefined,
    "PATCH",
  );
}
export function deleteRuntimeActiveMonitor(runtimeId, monitorId) {
  return deleteJson(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimeId)}/active-monitors/${encodeURIComponent(monitorId)}`,
  );
}
export function createRuntimeManualMonitoringObservation(
  runtimeId,
  observation,
) {
  return sendJson(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimeId)}/manual-observations`,
    observation,
    undefined,
    "POST",
  );
}
export function fetchApplicationMonitoringHealth(applicationId, params) {
  return fetchJson(
    `/api/monitoring/applications/${encodeURIComponent(applicationId)}/health`,
    params,
  );
}

export const fetchTopologyDiagrams = (applicationId, params) =>
  applicationCollection(applicationId, "topology-diagrams", params);
export const fetchTopologyDiagram = (diagramId) =>
  catalogDetail("topology-diagrams", diagramId);
export const createTopologyDiagram = (applicationId, diagram) =>
  createApplicationEntity(applicationId, "topology-diagrams", diagram);
export const updateTopologyDiagram = (diagramId, diagram) =>
  updateCatalogEntity("topology-diagrams", diagramId, diagram);
