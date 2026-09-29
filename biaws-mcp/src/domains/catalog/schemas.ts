import type { ToolDefinition } from "../../mcp/tools/contracts.js";
export const catalogTools = [
  {
    name: "applications_list",
    description: "Lista aplicações de um workspace com busca, status e paginação.",
    inputSchema: {
      type: "object",
      required: ["workspaceId"],
      additionalProperties: false,
      properties: {
        workspaceId: {
          type: "string",
          minLength: 1,
        },
        q: {
          type: "string",
          description: "Busca por key, nome e campos textuais.",
        },
        status: {
          type: "string",
        },
        includeArchived: {
          type: "boolean",
          default: false,
        },
        page: {
          type: "integer",
          minimum: 1,
          default: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50,
        },
      },
    },
  },

  {
    name: "applications_get_context",
    description:
      "Retorna contexto agregado, limitado e sanitizado da aplicação, incluindo integrações, topologia, servidores relacionados e conhecimento.",
    inputSchema: {
      type: "object",
      required: ["applicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 25,
        },
        includeArchived: {
          type: "boolean",
          default: false,
        },
      },
    },
  },
  {
    name: "components_list",
    description: "Lista componentes de uma aplicação.",
    inputSchema: {
      type: "object",
      required: ["applicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        q: {
          type: "string",
          description: "Busca por key, nome e campos textuais.",
        },
        status: {
          type: "string",
        },
        includeArchived: {
          type: "boolean",
          default: false,
        },
        page: {
          type: "integer",
          minimum: 1,
          default: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50,
        },
        type: {
          type: "string",
          enum: ["api", "ui", "worker", "service", "library", "integration", "other"],
        },
        repositoryId: {
          type: "string",
          minLength: 1,
        },
        dependencyComponentId: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },

  {
    name: "integrations_list",
    description: "Lista integrações direcionais de uma aplicação com outras aplicações do workspace.",
    inputSchema: {
      type: "object",
      required: ["applicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        q: {
          type: "string",
          description: "Busca por key, nome e campos textuais.",
        },
        status: {
          type: "string",
        },
        includeArchived: {
          type: "boolean",
          default: false,
        },
        page: {
          type: "integer",
          minimum: 1,
          default: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50,
        },
      },
    },
  },

  {
    name: "repositories_list",
    description: "Lista repositórios de uma aplicação.",
    inputSchema: {
      type: "object",
      required: ["applicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        q: {
          type: "string",
          description: "Busca por key, nome e campos textuais.",
        },
        status: {
          type: "string",
        },
        includeArchived: {
          type: "boolean",
          default: false,
        },
        page: {
          type: "integer",
          minimum: 1,
          default: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50,
        },
        provider: {
          type: "string",
          enum: ["github", "gitlab", "bitbucket", "azure-devops", "local", "other"],
        },
      },
    },
  },

  {
    name: "servers_list",
    description: "Lista servidores de um workspace.",
    inputSchema: {
      type: "object",
      required: ["workspaceId"],
      additionalProperties: false,
      properties: {
        workspaceId: {
          type: "string",
          minLength: 1,
        },
        q: {
          type: "string",
          description: "Busca por key, nome e campos textuais.",
        },
        status: {
          type: "string",
        },
        includeArchived: {
          type: "boolean",
          default: false,
        },
        page: {
          type: "integer",
          minimum: 1,
          default: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50,
        },
      },
    },
  },

  {
    name: "deployments_list",
    description: "Lista deployments de uma aplicação e aceita filtros de topologia.",
    inputSchema: {
      type: "object",
      required: ["applicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        q: {
          type: "string",
          description: "Busca por key, nome e campos textuais.",
        },
        status: {
          type: "string",
        },
        includeArchived: {
          type: "boolean",
          default: false,
        },
        page: {
          type: "integer",
          minimum: 1,
          default: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50,
        },
        componentId: {
          type: "string",
          minLength: 1,
        },
        repositoryId: {
          type: "string",
          minLength: 1,
        },
        environment: {
          type: "string",
          enum: ["development", "test", "staging", "production", "other"],
        },
        serverId: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },

  {
    name: "runtimes_list",
    description: "Lista runtimes de um deployment.",
    inputSchema: {
      type: "object",
      required: ["deploymentId"],
      additionalProperties: false,
      properties: {
        deploymentId: {
          type: "string",
          minLength: 1,
        },
        q: {
          type: "string",
          description: "Busca por key, nome e campos textuais.",
        },
        status: {
          type: "string",
        },
        includeArchived: {
          type: "boolean",
          default: false,
        },
        page: {
          type: "integer",
          minimum: 1,
          default: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50,
        },
        serverId: {
          type: "string",
          minLength: 1,
        },
        kind: {
          type: "string",
          enum: ["process", "container", "kubernetes", "serverless", "managed", "external", "other"],
        },
      },
    },
  },

  {
    name: "applications_create",
    description: "Cria uma aplicação no workspace informado. A API valida permissão e registra auditoria.",
    inputSchema: {
      type: "object",
      required: ["workspaceId", "key", "name"],
      additionalProperties: false,
      properties: {
        workspaceId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        owner: {
          type: "object",
          additionalProperties: false,
          properties: {
            team: {
              type: "string",
            },
            contact: {
              type: "string",
            },
          },
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
          maxItems: 50,
        },
        links: {
          type: "array",
          maxItems: 25,
          items: {
            type: "object",
            required: ["label", "url"],
            additionalProperties: false,
            properties: {
              label: {
                type: "string",
              },
              url: {
                type: "string",
                format: "uri",
              },
            },
          },
        },
      },
    },
  },
  {
    name: "applications_update",
    description: "Atualiza campos mutáveis de uma aplicação, incluindo seu identificador.",
    inputSchema: {
      type: "object",
      required: ["applicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        owner: {
          type: "object",
          additionalProperties: false,
          properties: {
            team: {
              type: "string",
            },
            contact: {
              type: "string",
            },
          },
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
          maxItems: 50,
        },
        links: {
          type: "array",
          maxItems: 25,
          items: {
            type: "object",
            required: ["label", "url"],
            additionalProperties: false,
            properties: {
              label: {
                type: "string",
              },
              url: {
                type: "string",
                format: "uri",
              },
            },
          },
        },
      },
    },
  },
  {
    name: "components_create",
    description: "Cria um componente em uma aplicação.",
    inputSchema: {
      type: "object",
      required: ["applicationId", "key", "name"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
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
              repositoryId: {
                type: "string",
                minLength: 1,
              },
              role: {
                type: "string",
                enum: ["source", "configuration", "infrastructure", "documentation", "other"],
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
              componentId: {
                type: "string",
                minLength: 1,
              },
              kind: {
                type: "string",
              },
              description: {
                type: "string",
              },
            },
          },
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
          maxItems: 50,
        },
      },
    },
  },
  {
    name: "components_update",
    description: "Atualiza um componente e suas relações validadas.",
    inputSchema: {
      type: "object",
      required: ["componentId"],
      additionalProperties: false,
      properties: {
        componentId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
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
              repositoryId: {
                type: "string",
                minLength: 1,
              },
              role: {
                type: "string",
                enum: ["source", "configuration", "infrastructure", "documentation", "other"],
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
              componentId: {
                type: "string",
                minLength: 1,
              },
              kind: {
                type: "string",
              },
              description: {
                type: "string",
              },
            },
          },
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
          maxItems: 50,
        },
      },
    },
  },
  {
    name: "integrations_create",
    description: "Cria uma integração direcionada para outra aplicação ativa do mesmo workspace.",
    inputSchema: {
      type: "object",
      required: ["applicationId", "key", "name", "targetApplicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        targetApplicationId: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
  {
    name: "integrations_update",
    description: "Atualiza uma integração, preservando sua origem e destino.",
    inputSchema: {
      type: "object",
      required: ["integrationId"],
      additionalProperties: false,
      properties: {
        integrationId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
      },
    },
  },
  {
    name: "repositories_create",
    description: "Cria um repositório sem credenciais em uma aplicação.",
    inputSchema: {
      type: "object",
      required: ["applicationId", "key", "name", "url"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        provider: {
          type: "string",
          enum: ["github", "gitlab", "bitbucket", "azure-devops", "local", "other"],
        },
        organization: {
          type: "string",
        },
        url: {
          type: "string",
          format: "uri",
        },
        defaultBranch: {
          type: "string",
        },
        sync: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: {
              type: "string",
              enum: ["manual", "connector"],
            },
            lastSyncedAt: {
              type: ["string", "null"],
            },
            state: {
              type: "string",
              enum: ["never", "pending", "synchronized", "failed"],
            },
          },
        },
      },
    },
  },
  {
    name: "repositories_update",
    description: "Atualiza um repositório; URLs com credenciais são recusadas pela API.",
    inputSchema: {
      type: "object",
      required: ["repositoryId"],
      additionalProperties: false,
      properties: {
        repositoryId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        provider: {
          type: "string",
          enum: ["github", "gitlab", "bitbucket", "azure-devops", "local", "other"],
        },
        organization: {
          type: "string",
        },
        url: {
          type: "string",
          format: "uri",
        },
        defaultBranch: {
          type: "string",
        },
        sync: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: {
              type: "string",
              enum: ["manual", "connector"],
            },
            lastSyncedAt: {
              type: ["string", "null"],
            },
            state: {
              type: "string",
              enum: ["never", "pending", "synchronized", "failed"],
            },
          },
        },
      },
    },
  },
  {
    name: "servers_create",
    description: "Cria um servidor no workspace sem armazenar credenciais.",
    inputSchema: {
      type: "object",
      required: ["workspaceId", "key", "name"],
      additionalProperties: false,
      properties: {
        workspaceId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        hostname: {
          type: "string",
        },
        addresses: {
          type: "array",
          items: {
            type: "string",
          },
          maxItems: 25,
        },
        provider: {
          type: "string",
        },
        location: {
          type: "string",
        },
        operatingSystem: {
          type: "string",
        },
        purpose: {
          type: "string",
        },
        status: {
          type: "string",
          enum: ["active", "maintenance", "retired"],
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
          maxItems: 50,
        },
      },
    },
  },
  {
    name: "servers_update",
    description: "Atualiza dados operacionais sanitizados de um servidor.",
    inputSchema: {
      type: "object",
      required: ["serverId"],
      additionalProperties: false,
      properties: {
        serverId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        hostname: {
          type: "string",
        },
        addresses: {
          type: "array",
          items: {
            type: "string",
          },
          maxItems: 25,
        },
        provider: {
          type: "string",
        },
        location: {
          type: "string",
        },
        operatingSystem: {
          type: "string",
        },
        purpose: {
          type: "string",
        },
        status: {
          type: "string",
          enum: ["active", "maintenance", "retired"],
        },
        tags: {
          type: "array",
          items: {
            type: "string",
          },
          maxItems: 50,
        },
      },
    },
  },
  {
    name: "deployments_create",
    description: "Cria um deployment para um componente da aplicação.",
    inputSchema: {
      type: "object",
      required: ["applicationId", "key", "name", "componentId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        componentId: {
          type: "string",
          minLength: 1,
        },
        environment: {
          type: "string",
          enum: ["development", "test", "staging", "production", "other"],
        },
        repositoryId: {
          type: ["string", "null"],
        },
        publications: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["version"],
            properties: {
              id: {
                type: "string",
                minLength: 1,
              },
              version: {
                type: "string",
              },
              revision: {
                type: "string",
              },
              repositoryId: {
                type: ["string", "null"],
              },
              status: {
                type: "string",
                enum: ["planned", "canceled", "deployed"],
              },
              publishedAt: {
                type: ["string", "null"],
              },
              description: {
                type: "string",
              },
              recordedAt: {
                type: ["string", "null"],
              },
              recordedBy: {
                type: "string",
              },
            },
          },
        },
        version: {
          type: "string",
        },
        source: {
          type: "object",
          additionalProperties: false,
          properties: {
            repositoryId: {
              type: "string",
              minLength: 1,
            },
            revision: {
              type: "string",
            },
          },
        },
        status: {
          type: "string",
          enum: ["planned", "deploying", "active", "inactive", "failed"],
        },
        deployedAt: {
          type: ["string", "null"],
        },
      },
    },
  },
  {
    name: "deployments_update",
    description: "Atualiza um deployment preservando seu componente imutável.",
    inputSchema: {
      type: "object",
      required: ["deploymentId"],
      additionalProperties: false,
      properties: {
        deploymentId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        environment: {
          type: "string",
          enum: ["development", "test", "staging", "production", "other"],
        },
        repositoryId: {
          type: ["string", "null"],
        },
        publications: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["version"],
            properties: {
              id: {
                type: "string",
                minLength: 1,
              },
              version: {
                type: "string",
              },
              revision: {
                type: "string",
              },
              repositoryId: {
                type: ["string", "null"],
              },
              status: {
                type: "string",
                enum: ["planned", "canceled", "deployed"],
              },
              publishedAt: {
                type: ["string", "null"],
              },
              description: {
                type: "string",
              },
              recordedAt: {
                type: ["string", "null"],
              },
              recordedBy: {
                type: "string",
              },
            },
          },
        },
        version: {
          type: "string",
        },
        source: {
          type: "object",
          additionalProperties: false,
          properties: {
            repositoryId: {
              type: "string",
              minLength: 1,
            },
            revision: {
              type: "string",
            },
          },
        },
        status: {
          type: "string",
          enum: ["planned", "deploying", "active", "inactive", "failed"],
        },
        deployedAt: {
          type: ["string", "null"],
        },
      },
    },
  },
  {
    name: "deployments_record_publication",
    description:
      "Registra uma publicação no histórico append-only de um deployment sem reenviar as entradas existentes.",
    inputSchema: {
      type: "object",
      required: ["deploymentId", "version"],
      additionalProperties: false,
      properties: {
        deploymentId: {
          type: "string",
          minLength: 1,
        },
        version: {
          type: "string",
        },
        revision: {
          type: "string",
        },
        repositoryId: {
          type: ["string", "null"],
        },
        status: {
          type: "string",
          enum: ["planned", "canceled", "deployed"],
        },
        publishedAt: {
          type: ["string", "null"],
        },
        description: {
          type: "string",
        },
      },
    },
  },
  {
    name: "runtimes_create",
    description: "Cria um runtime de deployment com metadata limitada e sem segredos.",
    inputSchema: {
      type: "object",
      required: ["deploymentId", "key", "name"],
      additionalProperties: false,
      properties: {
        deploymentId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        kind: {
          type: "string",
          enum: ["process", "container", "kubernetes", "serverless", "managed", "external", "other"],
        },
        serverId: {
          type: ["string", "null"],
        },
        endpoint: {
          type: "string",
        },
        port: {
          type: ["integer", "null"],
          minimum: 1,
          maximum: 65535,
        },
        namespace: {
          type: "string",
        },
        runtimeName: {
          type: "string",
        },
        status: {
          type: "string",
          enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
        },
        metadata: {
          type: "object",
          maxProperties: 25,
          additionalProperties: {
            oneOf: [
              {
                type: ["string", "number", "boolean", "null"],
              },
              {
                type: "array",
                maxItems: 20,
                items: {
                  type: ["string", "number", "boolean", "null"],
                },
              },
            ],
          },
        },
        monitoringRetentionDays: {
          type: "integer",
          minimum: 0,
          maximum: 3650,
        },
        documentLinks: {
          type: "array",
          maxItems: 100,
          items: {
            type: "object",
            required: ["documentId", "purpose"],
            additionalProperties: false,
            properties: {
              documentId: {
                type: "string",
                minLength: 1,
              },
              purpose: {
                type: "string",
                enum: ["operation", "deployment", "rollback", "troubleshooting", "monitoring", "reference"],
              },
            },
          },
        },
        operationalNotesMarkdown: {
          type: "string",
        },
        observedAt: {
          type: ["string", "null"],
        },
      },
    },
  },
  {
    name: "runtimes_update",
    description: "Atualiza um runtime; servidor e metadata são revalidados pela API.",
    inputSchema: {
      type: "object",
      required: ["runtimeId"],
      additionalProperties: false,
      properties: {
        runtimeId: {
          type: "string",
          minLength: 1,
        },
        key: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
        name: {
          type: "string",
        },
        kind: {
          type: "string",
          enum: ["process", "container", "kubernetes", "serverless", "managed", "external", "other"],
        },
        serverId: {
          type: ["string", "null"],
        },
        endpoint: {
          type: "string",
        },
        port: {
          type: ["integer", "null"],
          minimum: 1,
          maximum: 65535,
        },
        namespace: {
          type: "string",
        },
        runtimeName: {
          type: "string",
        },
        status: {
          type: "string",
          enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
        },
        metadata: {
          type: "object",
          maxProperties: 25,
          additionalProperties: {
            oneOf: [
              {
                type: ["string", "number", "boolean", "null"],
              },
              {
                type: "array",
                maxItems: 20,
                items: {
                  type: ["string", "number", "boolean", "null"],
                },
              },
            ],
          },
        },
        monitoringRetentionDays: {
          type: "integer",
          minimum: 0,
          maximum: 3650,
        },
        documentLinks: {
          type: "array",
          maxItems: 100,
          items: {
            type: "object",
            required: ["documentId", "purpose"],
            additionalProperties: false,
            properties: {
              documentId: {
                type: "string",
                minLength: 1,
              },
              purpose: {
                type: "string",
                enum: ["operation", "deployment", "rollback", "troubleshooting", "monitoring", "reference"],
              },
            },
          },
        },
        operationalNotesMarkdown: {
          type: "string",
        },
        observedAt: {
          type: ["string", "null"],
        },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];
