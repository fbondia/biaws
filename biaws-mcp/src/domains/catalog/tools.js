import {
  createApplication,
  createComponent,
  createDeployment,
  createIntegration,
  createRepository,
  createRuntime,
  createServer,
  getApplication,
  getApplicationContext,
  getComponent,
  getDeployment,
  getIntegration,
  getRepository,
  getRuntime,
  getServer,
  getWorkspace,
  listApplications,
  listComponents,
  listDeployments,
  listIntegrations,
  listRepositories,
  listRuntimes,
  listServers,
  listWorkspaces,
  updateApplication,
  updateComponent,
  updateDeployment,
  updateIntegration,
  updateRepository,
  updateRuntime,
  updateServer,
} from "./service.js";

const ID = { type: "string", minLength: 1 };
const STRING = { type: "string" };
const STRING_ARRAY = {
  type: "array",
  items: { type: "string" },
};
const TAGS = { ...STRING_ARRAY, maxItems: 50 };
const COMMON_LIST_PROPERTIES = {
  q: { type: "string", description: "Busca por key, nome e campos textuais." },
  status: { type: "string" },
  includeArchived: { type: "boolean", default: false },
  page: { type: "integer", minimum: 1, default: 1 },
  limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
};

const APPLICATION_PROPERTIES = {
  key: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
  name: STRING,
  description: STRING,
  owner: {
    type: "object",
    additionalProperties: false,
    properties: { team: STRING, contact: STRING },
  },
  tags: TAGS,
  links: {
    type: "array",
    maxItems: 25,
    items: {
      type: "object",
      required: ["label", "url"],
      additionalProperties: false,
      properties: { label: STRING, url: { type: "string", format: "uri" } },
    },
  },
};

const COMPONENT_PROPERTIES = {
  key: APPLICATION_PROPERTIES.key,
  name: STRING,
  description: STRING,
  type: {
    type: "string",
    enum: ["api", "ui", "worker", "service", "library", "integration", "other"],
  },
  repositoryLinks: {
    type: "array",
    maxItems: 100,
    items: {
      type: "object",
      required: ["repositoryId"],
      additionalProperties: false,
      properties: {
        repositoryId: ID,
        role: {
          type: "string",
          enum: [
            "source",
            "configuration",
            "infrastructure",
            "documentation",
            "other",
          ],
        },
      },
    },
  },
  dependencies: {
    type: "array",
    maxItems: 100,
    items: {
      type: "object",
      required: ["componentId"],
      additionalProperties: false,
      properties: {
        componentId: ID,
        kind: STRING,
        description: STRING,
      },
    },
  },
  tags: TAGS,
};

const INTEGRATION_PROPERTIES = {
  key: APPLICATION_PROPERTIES.key,
  name: STRING,
  description: STRING,
  targetApplicationId: ID,
};

const REPOSITORY_PROPERTIES = {
  key: APPLICATION_PROPERTIES.key,
  name: STRING,
  description: STRING,
  provider: {
    type: "string",
    enum: ["github", "gitlab", "bitbucket", "azure-devops", "local", "other"],
  },
  organization: STRING,
  url: { type: "string", format: "uri" },
  defaultBranch: STRING,
  sync: {
    type: "object",
    additionalProperties: false,
    properties: {
      mode: { type: "string", enum: ["manual", "connector"] },
      lastSyncedAt: { type: ["string", "null"] },
      state: {
        type: "string",
        enum: ["never", "pending", "synchronized", "failed"],
      },
    },
  },
};

const SERVER_PROPERTIES = {
  key: APPLICATION_PROPERTIES.key,
  name: STRING,
  description: STRING,
  hostname: STRING,
  addresses: { ...STRING_ARRAY, maxItems: 25 },
  provider: STRING,
  location: STRING,
  operatingSystem: STRING,
  purpose: STRING,
  status: {
    type: "string",
    enum: ["active", "maintenance", "retired"],
  },
  tags: TAGS,
};

const DEPLOYMENT_PROPERTIES = {
  key: APPLICATION_PROPERTIES.key,
  name: STRING,
  componentId: ID,
  environment: {
    type: "string",
    enum: ["development", "test", "staging", "production", "other"],
  },
  repositoryId: { type: ["string", "null"] },
  publications: {
    type: "array",
    maxItems: 200,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["version"],
      properties: {
        id: ID,
        version: STRING,
        revision: STRING,
        repositoryId: { type: ["string", "null"] },
        publishedAt: { type: ["string", "null"] },
        description: STRING,
        recordedAt: { type: ["string", "null"] },
        recordedBy: STRING,
      },
    },
  },
  // Campos legados materializados a partir da publicação mais recente.
  version: STRING,
  source: {
    type: "object",
    additionalProperties: false,
    properties: { repositoryId: ID, revision: STRING },
  },
  status: {
    type: "string",
    enum: ["planned", "deploying", "active", "inactive", "failed"],
  },
  deployedAt: { type: ["string", "null"] },
};

const RUNTIME_PROPERTIES = {
  key: APPLICATION_PROPERTIES.key,
  name: STRING,
  kind: {
    type: "string",
    enum: [
      "process",
      "container",
      "kubernetes",
      "serverless",
      "managed",
      "external",
      "other",
    ],
  },
  serverId: { type: ["string", "null"] },
  endpoint: STRING,
  port: { type: ["integer", "null"], minimum: 1, maximum: 65535 },
  namespace: STRING,
  runtimeName: STRING,
  status: {
    type: "string",
    enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
  },
  metadata: {
    type: "object",
    maxProperties: 25,
    additionalProperties: {
      oneOf: [
        { type: ["string", "number", "boolean", "null"] },
        {
          type: "array",
          maxItems: 20,
          items: { type: ["string", "number", "boolean", "null"] },
        },
      ],
    },
  },
  observations: {
    type: "array",
    maxItems: 200,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["healthStatus", "observedAt"],
      properties: {
        id: ID,
        healthStatus: {
          type: "string",
          enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
        },
        observedAt: { type: "string" },
        source: STRING,
        message: STRING,
        metadata: {
          type: "object",
          additionalProperties: true,
        },
        receivedAt: { type: ["string", "null"] },
        recordedBy: STRING,
      },
    },
  },
  procedureMarkdown: STRING,
  // Campo legado materializado a partir da observação mais recente.
  observedAt: { type: ["string", "null"] },
};

function schema(properties = {}, required = []) {
  return {
    type: "object",
    ...(required.length ? { required } : {}),
    additionalProperties: false,
    properties,
  };
}

function without(properties, ...fields) {
  const omitted = new Set(fields);
  return Object.fromEntries(
    Object.entries(properties).filter(([field]) => !omitted.has(field)),
  );
}

function definition(name, description, handler, inputSchema) {
  return { name, description, inputSchema, handler };
}

export const catalogTools = [
  definition(
    "workspaces_list",
    "Lista os workspaces acessíveis. Nesta fase existe somente o workspace operacional padrão.",
    listWorkspaces,
    schema(),
  ),
  definition(
    "workspaces_get",
    "Obtém um workspace pelo ID público.",
    getWorkspace,
    schema({ workspaceId: ID }, ["workspaceId"]),
  ),
  definition(
    "applications_list",
    "Lista aplicações de um workspace com busca, status e paginação.",
    listApplications,
    schema({ workspaceId: ID, ...COMMON_LIST_PROPERTIES }, ["workspaceId"]),
  ),
  definition(
    "applications_get",
    "Obtém os dados de uma aplicação pelo ID público.",
    getApplication,
    schema({ applicationId: ID }, ["applicationId"]),
  ),
  definition(
    "applications_get_context",
    "Retorna contexto agregado, limitado e sanitizado da aplicação, incluindo integrações, topologia, servidores relacionados e conhecimento.",
    getApplicationContext,
    schema(
      {
        applicationId: ID,
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        includeArchived: { type: "boolean", default: false },
      },
      ["applicationId"],
    ),
  ),
  definition(
    "components_list",
    "Lista componentes de uma aplicação.",
    listComponents,
    schema(
      {
        applicationId: ID,
        ...COMMON_LIST_PROPERTIES,
        type: COMPONENT_PROPERTIES.type,
        repositoryId: ID,
        dependencyComponentId: ID,
      },
      ["applicationId"],
    ),
  ),
  definition(
    "components_get",
    "Obtém um componente pelo ID público.",
    getComponent,
    schema({ componentId: ID }, ["componentId"]),
  ),
  definition(
    "integrations_list",
    "Lista integrações direcionais de uma aplicação com outras aplicações do workspace.",
    listIntegrations,
    schema({ applicationId: ID, ...COMMON_LIST_PROPERTIES }, ["applicationId"]),
  ),
  definition(
    "integrations_get",
    "Obtém uma integração pelo ID público.",
    getIntegration,
    schema({ integrationId: ID }, ["integrationId"]),
  ),
  definition(
    "repositories_list",
    "Lista repositórios de uma aplicação.",
    listRepositories,
    schema(
      {
        applicationId: ID,
        ...COMMON_LIST_PROPERTIES,
        provider: REPOSITORY_PROPERTIES.provider,
      },
      ["applicationId"],
    ),
  ),
  definition(
    "repositories_get",
    "Obtém um repositório pelo ID público.",
    getRepository,
    schema({ repositoryId: ID }, ["repositoryId"]),
  ),
  definition(
    "servers_list",
    "Lista servidores de um workspace.",
    listServers,
    schema({ workspaceId: ID, ...COMMON_LIST_PROPERTIES }, ["workspaceId"]),
  ),
  definition(
    "servers_get",
    "Obtém um servidor pelo ID público.",
    getServer,
    schema({ serverId: ID }, ["serverId"]),
  ),
  definition(
    "deployments_list",
    "Lista deployments de uma aplicação e aceita filtros de topologia.",
    listDeployments,
    schema(
      {
        applicationId: ID,
        ...COMMON_LIST_PROPERTIES,
        componentId: ID,
        repositoryId: ID,
        environment: DEPLOYMENT_PROPERTIES.environment,
        serverId: ID,
      },
      ["applicationId"],
    ),
  ),
  definition(
    "deployments_get",
    "Obtém um deployment pelo ID público.",
    getDeployment,
    schema({ deploymentId: ID }, ["deploymentId"]),
  ),
  definition(
    "runtimes_list",
    "Lista runtimes de um deployment.",
    listRuntimes,
    schema(
      {
        deploymentId: ID,
        ...COMMON_LIST_PROPERTIES,
        serverId: ID,
        kind: RUNTIME_PROPERTIES.kind,
      },
      ["deploymentId"],
    ),
  ),
  definition(
    "runtimes_get",
    "Obtém um runtime pelo ID público.",
    getRuntime,
    schema({ runtimeId: ID }, ["runtimeId"]),
  ),
  definition(
    "applications_create",
    "Cria uma aplicação no workspace informado. A API valida permissão e registra auditoria.",
    createApplication,
    schema({ workspaceId: ID, ...APPLICATION_PROPERTIES }, [
      "workspaceId",
      "key",
      "name",
    ]),
  ),
  definition(
    "applications_update",
    "Atualiza campos mutáveis de uma aplicação, incluindo seu identificador.",
    updateApplication,
    schema({ applicationId: ID, ...APPLICATION_PROPERTIES }, ["applicationId"]),
  ),
  definition(
    "components_create",
    "Cria um componente em uma aplicação.",
    createComponent,
    schema({ applicationId: ID, ...COMPONENT_PROPERTIES }, [
      "applicationId",
      "key",
      "name",
    ]),
  ),
  definition(
    "components_update",
    "Atualiza um componente e suas relações validadas.",
    updateComponent,
    schema({ componentId: ID, ...COMPONENT_PROPERTIES }, ["componentId"]),
  ),
  definition(
    "integrations_create",
    "Cria uma integração direcionada para outra aplicação ativa do mesmo workspace.",
    createIntegration,
    schema({ applicationId: ID, ...INTEGRATION_PROPERTIES }, [
      "applicationId",
      "key",
      "name",
      "targetApplicationId",
    ]),
  ),
  definition(
    "integrations_update",
    "Atualiza uma integração, preservando sua origem e destino.",
    updateIntegration,
    schema(
      {
        integrationId: ID,
        ...without(INTEGRATION_PROPERTIES, "targetApplicationId"),
      },
      ["integrationId"],
    ),
  ),
  definition(
    "repositories_create",
    "Cria um repositório sem credenciais em uma aplicação.",
    createRepository,
    schema({ applicationId: ID, ...REPOSITORY_PROPERTIES }, [
      "applicationId",
      "key",
      "name",
      "url",
    ]),
  ),
  definition(
    "repositories_update",
    "Atualiza um repositório; URLs com credenciais são recusadas pela API.",
    updateRepository,
    schema({ repositoryId: ID, ...REPOSITORY_PROPERTIES }, ["repositoryId"]),
  ),
  definition(
    "servers_create",
    "Cria um servidor no workspace sem armazenar credenciais.",
    createServer,
    schema({ workspaceId: ID, ...SERVER_PROPERTIES }, [
      "workspaceId",
      "key",
      "name",
    ]),
  ),
  definition(
    "servers_update",
    "Atualiza dados operacionais sanitizados de um servidor.",
    updateServer,
    schema({ serverId: ID, ...SERVER_PROPERTIES }, ["serverId"]),
  ),
  definition(
    "deployments_create",
    "Cria um deployment para um componente da aplicação.",
    createDeployment,
    schema({ applicationId: ID, ...DEPLOYMENT_PROPERTIES }, [
      "applicationId",
      "key",
      "name",
      "componentId",
    ]),
  ),
  definition(
    "deployments_update",
    "Atualiza um deployment preservando seu componente imutável.",
    updateDeployment,
    schema(
      {
        deploymentId: ID,
        ...without(DEPLOYMENT_PROPERTIES, "componentId"),
      },
      ["deploymentId"],
    ),
  ),
  definition(
    "runtimes_create",
    "Cria um runtime de deployment com metadata limitada e sem segredos.",
    createRuntime,
    schema({ deploymentId: ID, ...RUNTIME_PROPERTIES }, [
      "deploymentId",
      "key",
      "name",
    ]),
  ),
  definition(
    "runtimes_update",
    "Atualiza um runtime; servidor e metadata são revalidados pela API.",
    updateRuntime,
    schema({ runtimeId: ID, ...RUNTIME_PROPERTIES }, ["runtimeId"]),
  ),
];
