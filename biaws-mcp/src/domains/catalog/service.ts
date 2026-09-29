import type { ServiceArguments } from "../../contracts.js";
import { BiawsError } from "../../errors.js";
import { cleanParams, fetchJson, sendJson } from "../../httpClient.js";

function requiredId(args: Record<string, unknown>, field: string) {
  const value = String(args?.[field] || "").trim();
  if (!value) throw new BiawsError(`${field} is required`);
  return value;
}

function entityPath(segment: string, id: string) {
  return `/api/catalog/${segment}/${encodeURIComponent(id)}`;
}

function listParams(
  args: Record<string, unknown> = {},
  additional: string[] = [],
) {
  return cleanParams({
    q: args.q,
    status: args.status,
    includeArchived: args.includeArchived,
    page: args.page,
    limit: args.limit,
    ...Object.fromEntries(additional.map((field) => [field, args[field]])),
  });
}

function mutationPayload(
  args: Record<string, unknown> = {},
  omitted: string[] = [],
) {
  const excluded = new Set(omitted);
  const payload = Object.fromEntries(
    Object.entries(args).filter(
      ([field, value]) => !excluded.has(field) && value !== undefined,
    ),
  );
  if (!Object.keys(payload).length) {
    throw new BiawsError("at least one mutable field is required");
  }
  return payload;
}

export async function listWorkspaces() {
  return fetchJson("/api/catalog/workspaces");
}

export async function getWorkspace(
  args: ServiceArguments<"workspaces_get"> = {},
) {
  return fetchJson(entityPath("workspaces", requiredId(args, "workspaceId")));
}

export async function listApplications(
  args: ServiceArguments<"applications_list"> = {},
) {
  const workspaceId = requiredId(args, "workspaceId");
  return fetchJson(
    `${entityPath("workspaces", workspaceId)}/applications`,
    listParams(args),
  );
}

export async function getApplication(
  args: ServiceArguments<"applications_get"> = {},
) {
  return fetchJson(
    entityPath("applications", requiredId(args, "applicationId")),
  );
}

export async function getApplicationContext(
  args: ServiceArguments<"applications_get_context"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/context`,
    cleanParams({
      limit: args.limit,
      includeArchived: args.includeArchived,
    }),
  );
}

export async function createApplication(
  args: ServiceArguments<"applications_create"> = {},
) {
  const workspaceId = requiredId(args, "workspaceId");
  return sendJson(
    `${entityPath("workspaces", workspaceId)}/applications`,
    mutationPayload(args, ["workspaceId"]),
    {},
    "POST",
  );
}

export async function updateApplication(
  args: ServiceArguments<"applications_update"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    entityPath("applications", applicationId),
    mutationPayload(args, ["applicationId"]),
    {},
    "PATCH",
  );
}

export async function listComponents(
  args: ServiceArguments<"components_list"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/components`,
    listParams(args, ["type", "repositoryId", "dependencyComponentId"]),
  );
}

export async function getComponent(
  args: ServiceArguments<"components_get"> = {},
) {
  return fetchJson(entityPath("components", requiredId(args, "componentId")));
}

export async function listIntegrations(
  args: ServiceArguments<"integrations_list"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/integrations`,
    listParams(args),
  );
}

export async function getIntegration(
  args: ServiceArguments<"integrations_get"> = {},
) {
  return fetchJson(
    entityPath("integrations", requiredId(args, "integrationId")),
  );
}

export async function createIntegration(
  args: ServiceArguments<"integrations_create"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    `${entityPath("applications", applicationId)}/integrations`,
    mutationPayload(args, ["applicationId"]),
    {},
    "POST",
  );
}

export async function updateIntegration(
  args: ServiceArguments<"integrations_update"> = {},
) {
  const integrationId = requiredId(args, "integrationId");
  return sendJson(
    entityPath("integrations", integrationId),
    mutationPayload(args, ["integrationId"]),
    {},
    "PATCH",
  );
}

export async function createComponent(
  args: ServiceArguments<"components_create"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    `${entityPath("applications", applicationId)}/components`,
    mutationPayload(args, ["applicationId"]),
    {},
    "POST",
  );
}

export async function updateComponent(
  args: ServiceArguments<"components_update"> = {},
) {
  const componentId = requiredId(args, "componentId");
  return sendJson(
    entityPath("components", componentId),
    mutationPayload(args, ["componentId"]),
    {},
    "PATCH",
  );
}

export async function listRepositories(
  args: ServiceArguments<"repositories_list"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `${entityPath("applications", applicationId)}/repositories`,
    listParams(args, ["provider"]),
  );
}

export async function getRepository(
  args: ServiceArguments<"repositories_get"> = {},
) {
  return fetchJson(
    entityPath("repositories", requiredId(args, "repositoryId")),
  );
}

export async function createRepository(
  args: ServiceArguments<"repositories_create"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    `${entityPath("applications", applicationId)}/repositories`,
    mutationPayload(args, ["applicationId"]),
    {},
    "POST",
  );
}

export async function updateRepository(
  args: ServiceArguments<"repositories_update"> = {},
) {
  const repositoryId = requiredId(args, "repositoryId");
  return sendJson(
    entityPath("repositories", repositoryId),
    mutationPayload(args, ["repositoryId"]),
    {},
    "PATCH",
  );
}

export async function listServers(args: ServiceArguments<"servers_list"> = {}) {
  const workspaceId = requiredId(args, "workspaceId");
  return fetchJson(
    `${entityPath("workspaces", workspaceId)}/servers`,
    listParams(args),
  );
}

export async function getServer(args: ServiceArguments<"servers_get"> = {}) {
  return fetchJson(entityPath("servers", requiredId(args, "serverId")));
}

export async function createServer(
  args: ServiceArguments<"servers_create"> = {},
) {
  const workspaceId = requiredId(args, "workspaceId");
  return sendJson(
    `${entityPath("workspaces", workspaceId)}/servers`,
    mutationPayload(args, ["workspaceId"]),
    {},
    "POST",
  );
}

export async function updateServer(
  args: ServiceArguments<"servers_update"> = {},
) {
  const serverId = requiredId(args, "serverId");
  return sendJson(
    entityPath("servers", serverId),
    mutationPayload(args, ["serverId"]),
    {},
    "PATCH",
  );
}

export async function listDeployments(
  args: ServiceArguments<"deployments_list"> = {},
) {
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

export async function getDeployment(
  args: ServiceArguments<"deployments_get"> = {},
) {
  return fetchJson(entityPath("deployments", requiredId(args, "deploymentId")));
}

export async function createDeployment(
  args: ServiceArguments<"deployments_create"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return sendJson(
    `${entityPath("applications", applicationId)}/deployments`,
    mutationPayload(args, ["applicationId"]),
    {},
    "POST",
  );
}

export async function updateDeployment(
  args: ServiceArguments<"deployments_update"> = {},
) {
  const deploymentId = requiredId(args, "deploymentId");
  return sendJson(
    entityPath("deployments", deploymentId),
    mutationPayload(args, ["deploymentId"]),
    {},
    "PATCH",
  );
}

export async function recordDeploymentPublication(
  args: ServiceArguments<"deployments_record_publication"> = {},
) {
  const deploymentId = requiredId(args, "deploymentId");
  return sendJson(
    `${entityPath("deployments", deploymentId)}/publications`,
    mutationPayload(args, ["deploymentId"]),
    {},
    "POST",
  );
}

export async function listRuntimes(
  args: ServiceArguments<"runtimes_list"> = {},
) {
  const deploymentId = requiredId(args, "deploymentId");
  return fetchJson(
    `${entityPath("deployments", deploymentId)}/runtimes`,
    listParams(args, ["serverId", "kind"]),
  );
}

export async function getRuntime(args: ServiceArguments<"runtimes_get"> = {}) {
  return fetchJson(entityPath("runtimes", requiredId(args, "runtimeId")));
}

export async function createRuntime(
  args: ServiceArguments<"runtimes_create"> = {},
) {
  const deploymentId = requiredId(args, "deploymentId");
  return sendJson(
    `${entityPath("deployments", deploymentId)}/runtimes`,
    mutationPayload(args, ["deploymentId"]),
    {},
    "POST",
  );
}

export async function updateRuntime(
  args: ServiceArguments<"runtimes_update"> = {},
) {
  const runtimeId = requiredId(args, "runtimeId");
  return sendJson(
    entityPath("runtimes", runtimeId),
    mutationPayload(args, ["runtimeId"]),
    {},
    "PATCH",
  );
}
