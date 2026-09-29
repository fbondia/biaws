import type { ToolDefinition } from "../../mcp/tools/contracts.js";
export const monitoringTools = [
  {
    name: "applications_monitoring_health_get",
    description:
      "Consulta a saúde consolidada e os detalhes de monitoramento de uma aplicação. includeConfigured inclui runtimes com monitores configurados mesmo sem resultados recebidos.",
    inputSchema: {
      type: "object",
      required: ["applicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        includeConfigured: {
          type: "boolean",
          default: false,
        },
      },
    },
  },
  {
    name: "runtime_monitoring_signals_list",
    description:
      "Lista uma página de sinais passivos ou externos de um runtime, filtrados por período e status. Para incluir resultados de monitores ativos, use runtime_monitoring_results_list.",
    inputSchema: {
      type: "object",
      required: ["runtimeReference"],
      additionalProperties: false,
      properties: {
        runtimeReference: {
          type: "string",
          minLength: 1,
        },
        observedFrom: {
          type: "string",
          description: "Data YYYY-MM-DD ou instante ISO 8601 inicial, inclusivo.",
        },
        observedTo: {
          type: "string",
          description: "Data YYYY-MM-DD incluindo o dia inteiro ou instante ISO 8601 final, inclusivo.",
        },
        status: {
          type: "string",
          enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
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
    name: "monitoring_templates_list",
    description:
      "Lista templates de monitoramento versionados do workspace configurado, com filtro de status e paginação.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          enum: ["draft", "active", "inactive"],
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
    name: "monitoring_templates_preview",
    description:
      "Testa uma definição de template com uma amostra JSON sanitizada sem persistir nem registrar observação.",
    inputSchema: {
      type: "object",
      required: ["definition"],
      additionalProperties: false,
      properties: {
        definition: {
          type: "object",
          additionalProperties: true,
        },
        sample: {},
      },
    },
  },
  {
    name: "monitoring_templates_create",
    description: "Cria a primeira versão em rascunho de um template no workspace configurado.",
    inputSchema: {
      type: "object",
      required: ["name", "definition"],
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        definition: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  },
  {
    name: "monitoring_templates_create_version",
    description: "Cria uma nova versão em rascunho derivada do template informado, preservando as versões anteriores.",
    inputSchema: {
      type: "object",
      required: ["templateId"],
      additionalProperties: false,
      properties: {
        templateId: {
          type: "string",
          minLength: 1,
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        definition: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  },

  {
    name: "monitoring_templates_validate",
    description: "Valida uma amostra JSON usando uma versão persistida, sem registrar observação.",
    inputSchema: {
      type: "object",
      required: ["templateId", "version", "sample"],
      additionalProperties: false,
      properties: {
        templateId: {
          type: "string",
          minLength: 1,
        },
        version: {
          type: "string",
          minLength: 1,
        },
        sample: {},
      },
    },
  },
  {
    name: "monitoring_templates_activate",
    description: "Ativa uma versão validada e inativa automaticamente outra versão ativa do mesmo template.",
    inputSchema: {
      type: "object",
      required: ["templateId", "version"],
      additionalProperties: false,
      properties: {
        templateId: {
          type: "string",
          minLength: 1,
        },
        version: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
  {
    name: "monitoring_templates_deactivate",
    description: "Desativa explicitamente uma versão de template sem removê-la nem alterar o histórico.",
    inputSchema: {
      type: "object",
      required: ["templateId", "version"],
      additionalProperties: false,
      properties: {
        templateId: {
          type: "string",
          minLength: 1,
        },
        version: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
  {
    name: "monitoring_templates_archive",
    description: "Arquiva uma versão de template identificada explicitamente; a API recusa versões ainda em uso.",
    inputSchema: {
      type: "object",
      required: ["templateId", "version"],
      additionalProperties: false,
      properties: {
        templateId: {
          type: "string",
          minLength: 1,
        },
        version: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
  {
    name: "runtime_monitoring_results_list",
    description:
      "Lista resultados históricos unificados de monitoramento de um runtime, com filtros por instante inicial, instante final e status.",
    inputSchema: {
      type: "object",
      required: ["runtimeReference"],
      additionalProperties: false,
      properties: {
        runtimeReference: {
          type: "string",
          minLength: 1,
        },
        observedFrom: {
          type: "string",
          description: "Data (YYYY-MM-DD) ou instante ISO 8601 inicial, inclusivo",
        },
        observedTo: {
          type: "string",
          description: "Data (YYYY-MM-DD, incluindo o dia inteiro) ou instante ISO 8601 final, inclusivo",
        },
        status: {
          type: "string",
          enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
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
    name: "runtime_monitoring_health_summary",
    description:
      "Resume a evolução temporal da saúde de um runtime em séries agregadas por monitor, preservando o pior estado de cada intervalo e limitando a quantidade de pontos.",
    inputSchema: {
      type: "object",
      required: ["runtimeReference"],
      additionalProperties: false,
      properties: {
        runtimeReference: {
          type: "string",
          minLength: 1,
        },
        observedFrom: {
          type: "string",
          description: "Data (YYYY-MM-DD) ou instante ISO 8601 inicial; o padrão cobre 30 dias antes do limite final",
        },
        observedTo: {
          type: "string",
          description:
            "Data (YYYY-MM-DD, incluindo o dia inteiro) ou instante ISO 8601 final; o padrão é o instante atual",
        },
        status: {
          type: "string",
          enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
        },
        resolution: {
          type: "string",
          enum: ["auto", "1m", "5m", "15m", "1h", "6h", "1d", "7d", "30d"],
          default: "auto",
        },
        maxPoints: {
          type: "integer",
          minimum: 50,
          maximum: 1000,
          default: 400,
        },
      },
    },
  },

  {
    name: "runtime_active_monitors_create",
    description:
      "Cria um monitoramento REST ou Shell para um runtime; referências de template são aceitas somente para REST.",
    inputSchema: {
      type: "object",
      required: ["runtimeReference", "name", "provider", "configuration"],
      additionalProperties: false,
      properties: {
        runtimeReference: {
          type: "string",
          minLength: 1,
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        provider: {
          type: "string",
          enum: ["rest", "shell"],
        },
        enabled: {
          type: "boolean",
        },
        intervalSeconds: {
          type: "integer",
          minimum: 10,
          maximum: 86400,
        },
        timeoutSeconds: {
          type: "integer",
          minimum: 1,
          maximum: 300,
        },
        configuration: {
          type: "object",
          additionalProperties: true,
        },
        templateRef: {
          type: ["object", "null"],
          additionalProperties: false,
          required: ["id", "version"],
          properties: {
            id: {
              type: "string",
              minLength: 1,
            },
            version: {
              type: "string",
              minLength: 1,
            },
          },
        },
      },
    },
  },
  {
    name: "runtime_active_monitors_update",
    description:
      "Atualiza a configuração de um monitoramento ativo existente, preservando validação, auditoria e tenancy da API.",
    inputSchema: {
      type: "object",
      required: ["runtimeReference", "monitorId"],
      additionalProperties: false,
      properties: {
        runtimeReference: {
          type: "string",
          minLength: 1,
        },
        monitorId: {
          type: "string",
          minLength: 1,
        },
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        provider: {
          type: "string",
          enum: ["rest", "shell"],
        },
        enabled: {
          type: "boolean",
        },
        intervalSeconds: {
          type: "integer",
          minimum: 10,
          maximum: 86400,
        },
        timeoutSeconds: {
          type: "integer",
          minimum: 1,
          maximum: 300,
        },
        configuration: {
          type: "object",
          additionalProperties: true,
        },
        templateRef: {
          type: ["object", "null"],
          additionalProperties: false,
          required: ["id", "version"],
          properties: {
            id: {
              type: "string",
              minLength: 1,
            },
            version: {
              type: "string",
              minLength: 1,
            },
          },
        },
      },
    },
  },
  {
    name: "runtime_active_monitors_archive",
    description:
      "Arquiva um monitoramento ativo identificado pelo runtime e monitorId, interrompendo futuras execuções.",
    inputSchema: {
      type: "object",
      required: ["runtimeReference", "monitorId"],
      additionalProperties: false,
      properties: {
        runtimeReference: {
          type: "string",
          minLength: 1,
        },
        monitorId: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];
