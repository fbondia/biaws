import { cleanParams, fetchJson, sendJson } from "../../httpClient.js";

function requiredId(args, field) {
  const value = String(args?.[field] || "").trim();
  if (!value) throw new Error(`${field} is required`);
  return value;
}

function entityPath(segment, id) {
  return `/api/catalog/${segment}/${encodeURIComponent(id)}`;
}

function listParams(args = {}, additional = []) {
  return cleanParams({
    q: args.q,
    status: args.status,
    includeArchived: args.includeArchived,
    page: args.page,
    limit: args.limit,
    ...Object.fromEntries(additional.map((field) => [field, args[field]])),
  });
}

function mutationPayload(args = {}, omitted = []) {
  const excluded = new Set(omitted);
  const payload = Object.fromEntries(
    Object.entries(args).filter(
      ([field, value]) => !excluded.has(field) && value !== undefined,
    ),
  );
  if (!Object.keys(payload).length) {
    throw new Error("at least one mutable field is required");
  }
  return payload;
}

export async function listWorkspaces() {
  return fetchJson("/api/catalog/workspaces");
}

export async function getWorkspace(args = {}) {
  return fetchJson(entityPath("workspaces", requiredId(args, "workspaceId")));
}

export async function listApplications(args = {}) {
  const workspaceId = requiredId(args, "workspaceId");
  return fetchJson(
    `${entityPath("workspaces", workspaceId)}/applications`,
    listParams(args),
  );
}

export async function getApplication(args = {}) {
  return fetchJson(
    entityPath("applications", requiredId(args, "applicationId")),
  );
}

export async function getApplicationContext(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/context`,
    cleanParams({
      limit: args.limit,
      includeArchived: args.includeArchived,
    }),
  );
}

export async function createApplication(args = {}) {
  const workspaceId = requiredId(args, "workspaceId");
  return sendJson(
    `${entityPath("workspaces", workspaceId)}/applications`,
    mutationPayload(args, ["workspaceId"]),
    {},
    "POST",
  );
}

export async function updateApplication(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    entityPath("applications", applicationId),
    mutationPayload(args, ["applicationId"]),
    {},
    "PATCH",
  );
}

export async function listComponents(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/components`,
    listParams(args, ["type", "repositoryId", "dependencyComponentId"]),
  );
}

export async function getComponent(args = {}) {
  return fetchJson(entityPath("components", requiredId(args, "componentId")));
}

export async function listIntegrations(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/integrations`,
    listParams(args),
  );
}

export async function getIntegration(args = {}) {
  return fetchJson(
    entityPath("integrations", requiredId(args, "integrationId")),
  );
}

export async function createIntegration(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    `${entityPath("applications", applicationId)}/integrations`,
    mutationPayload(args, ["applicationId"]),
    {},
    "POST",
  );
}

export async function updateIntegration(args = {}) {
  const integrationId = requiredId(args, "integrationId");
  return sendJson(
    entityPath("integrations", integrationId),
    mutationPayload(args, ["integrationId"]),
    {},
    "PATCH",
  );
}

export async function createComponent(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    `${entityPath("applications", applicationId)}/components`,
    mutationPayload(args, ["applicationId"]),
    {},
    "POST",
  );
}

export async function updateComponent(args = {}) {
  const componentId = requiredId(args, "componentId");
  return sendJson(
    entityPath("components", componentId),
    mutationPayload(args, ["componentId"]),
    {},
    "PATCH",
  );
}

export async function listRepositories(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/repositories`,
    listParams(args, ["provider"]),
  );
}

export async function getRepository(args = {}) {
  return fetchJson(
    entityPath("repositories", requiredId(args, "repositoryId")),
  );
}

export async function createRepository(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    `${entityPath("applications", applicationId)}/repositories`,
    mutationPayload(args, ["applicationId"]),
    {},
    "POST",
  );
}

export async function updateRepository(args = {}) {
  const repositoryId = requiredId(args, "repositoryId");
  return sendJson(
    entityPath("repositories", repositoryId),
    mutationPayload(args, ["repositoryId"]),
    {},
    "PATCH",
  );
}

export async function listServers(args = {}) {
  const workspaceId = requiredId(args, "workspaceId");
  return fetchJson(
    `${entityPath("workspaces", workspaceId)}/servers`,
    listParams(args),
  );
}

export async function getServer(args = {}) {
  return fetchJson(entityPath("servers", requiredId(args, "serverId")));
}

export async function createServer(args = {}) {
  const workspaceId = requiredId(args, "workspaceId");
  return sendJson(
    `${entityPath("workspaces", workspaceId)}/servers`,
    mutationPayload(args, ["workspaceId"]),
    {},
    "POST",
  );
}

export async function updateServer(args = {}) {
  const serverId = requiredId(args, "serverId");
  return sendJson(
    entityPath("servers", serverId),
    mutationPayload(args, ["serverId"]),
    {},
    "PATCH",
  );
}

export async function listDeployments(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/deployments`,
    listParams(args, [
      "componentId",
      "repositoryId",
      "environment",
      "serverId",
    ]),
  );
}

export async function getDeployment(args = {}) {
  return fetchJson(entityPath("deployments", requiredId(args, "deploymentId")));
}

export async function createDeployment(args = {}) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    `${entityPath("applications", applicationId)}/deployments`,
    mutationPayload(args, ["applicationId"]),
    {},
    "POST",
  );
}

export async function updateDeployment(args = {}) {
  const deploymentId = requiredId(args, "deploymentId");
  return sendJson(
    entityPath("deployments", deploymentId),
    mutationPayload(args, ["deploymentId"]),
    {},
    "PATCH",
  );
}

export async function listRuntimes(args = {}) {
  const deploymentId = requiredId(args, "deploymentId");
  return fetchJson(
    `${entityPath("deployments", deploymentId)}/runtimes`,
    listParams(args, ["serverId", "kind"]),
  );
}

export async function getRuntime(args = {}) {
  return fetchJson(entityPath("runtimes", requiredId(args, "runtimeId")));
}

export async function createRuntime(args = {}) {
  const deploymentId = requiredId(args, "deploymentId");
  return sendJson(
    `${entityPath("deployments", deploymentId)}/runtimes`,
    mutationPayload(args, ["deploymentId"]),
    {},
    "POST",
  );
}

export async function updateRuntime(args = {}) {
  const runtimeId = requiredId(args, "runtimeId");
  return sendJson(
    entityPath("runtimes", runtimeId),
    mutationPayload(args, ["runtimeId"]),
    {},
    "PATCH",
  );
}
