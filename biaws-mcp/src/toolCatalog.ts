import type { ToolDefinition } from "./contracts.js";
import { attachmentTools } from "./domains/attachments/schemas.js";
import { auditTools } from "./domains/audit/schemas.js";
import { catalogTools } from "./domains/catalog/schemas.js";
import { collectionTools } from "./domains/collections/schemas.js";
import { demandMutationTools } from "./domains/demands/schemas.js";
import { knowledgeTools } from "./domains/knowledge/schemas.js";
import { monitoringTools } from "./domains/monitoring/schemas.js";
import { secretTools } from "./domains/secrets/schemas.js";
export const toolDefinitions = [
  ...catalogTools,
  ...collectionTools,
  ...secretTools,
  ...knowledgeTools,
  ...attachmentTools,
  ...demandMutationTools,
  ...auditTools,
  ...monitoringTools,
  ...[
    {
      name: "issues_search",
      description:
        "Busca issues de suporte com filtros por código, texto, tipo, status, datas, tags, paginação e ordenação.",
      inputSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          workspaceId: {
            type: "string",
            description: "ID público do workspace",
          },
          applicationId: {
            type: "string",
            description: "ID público da aplicação",
          },
          componentId: {
            type: "string",
            description: "ID de um componente afetado",
          },
          codigo: {
            type: "string",
          },
          code: {
            type: "string",
          },
          id: {
            type: "string",
          },
          tipo: {
            type: "string",
            description: "incident, request ou lista separada por vírgula",
          },
          type: {
            type: "string",
            description: "incident, request ou lista separada por vírgula",
          },
          status: {
            type: "string",
            description: "open, closed ou lista separada por vírgula",
          },
          texto: {
            type: "string",
          },
          text: {
            type: "string",
          },
          q: {
            type: "string",
          },
          title: {
            type: "string",
          },
          from: {
            type: "string",
            description: "YYYY-MM-DD",
          },
          to: {
            type: "string",
            description: "YYYY-MM-DD",
          },
          dateField: {
            type: "string",
            enum: [
              "receivedEmailAt",
              "issueCreatedAt",
              "firstThreadEmailAt",
              "closedAt",
              "updatedAt",
            ],
          },
          sort: {
            type: "string",
          },
          order: {
            type: "string",
            enum: ["asc", "desc"],
          },
          page: {
            type: "integer",
            minimum: 1,
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
    {
      name: "issues_get",
      description: "Obtém uma issue com comentários e anexos.",
      inputSchema: {
        type: "object",
        required: ["issueId"],
        additionalProperties: false,
        properties: {
          issueId: {
            type: "string",
          },
        },
      },
    },
    {
      name: "issues_update",
      description:
        "Atualiza título, texto, tipo, status, aplicação e componentes afetados de uma issue. Informe ao menos um campo; campos omitidos são preservados pela API.",
      inputSchema: {
        type: "object",
        required: ["issueId"],
        additionalProperties: false,
        properties: {
          issueId: {
            type: "string",
            minLength: 1,
            description: "ID ou identificador exato da issue",
          },
          identifier: {
            type: "string",
            maxLength: 100,
            description:
              "Identificador de negócio; vazio remove o identificador",
          },
          title: {
            type: "string",
            minLength: 1,
          },
          text: {
            type: "string",
            minLength: 1,
            description: "Conteúdo em Markdown.",
          },
          type: {
            type: "string",
            enum: ["incident", "request"],
          },
          status: {
            type: "string",
            enum: ["open", "closed"],
          },
          applicationId: {
            type: "string",
            minLength: 1,
          },
          affectedComponentIds: {
            type: "array",
            maxItems: 100,
            uniqueItems: true,
            items: {
              type: "string",
              minLength: 1,
            },
          },
        },
      },
    },
    {
      name: "issues_add_comment",
      description: "Adiciona um comentário em Markdown a uma issue existente.",
      inputSchema: {
        type: "object",
        required: ["issueId", "text"],
        additionalProperties: false,
        properties: {
          issueId: {
            type: "string",
            minLength: 1,
            description: "ID ou identificador exato da issue",
          },
          text: {
            type: "string",
            minLength: 1,
            description: "Conteúdo do comentário em Markdown.",
          },
          date: {
            type: "string",
            description:
              "Data do comentário em formato aceito pela API; usa o momento atual quando omitida.",
          },
        },
      },
    },
    {
      name: "issues_update_comment",
      description:
        "Atualiza o conteúdo e, opcionalmente, a data de um comentário de issue.",
      inputSchema: {
        type: "object",
        required: ["issueId", "commentId", "text"],
        additionalProperties: false,
        properties: {
          issueId: {
            type: "string",
            minLength: 1,
            description: "ID ou identificador exato da issue",
          },
          commentId: {
            type: "string",
            minLength: 1,
            description: "ID do comentário retornado por issues_get.",
          },
          text: {
            type: "string",
            minLength: 1,
            description: "Novo conteúdo do comentário em Markdown.",
          },
          date: {
            type: "string",
            description:
              "Nova data do comentário; usa o momento atual quando omitida.",
          },
        },
      },
    },
    {
      name: "issues_get_classification_catalog",
      description:
        "Obtém a árvore de taxonomia e os grupos de tags válidos para analisar e classificar issues.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          applicationId: {
            type: "string",
            description:
              "Retorna somente assuntos compartilhados e aplicáveis à aplicação",
          },
          flatten: {
            type: "boolean",
            default: false,
            description:
              "Inclui taxonomyOptions e tagOptions achatados, preservando também a árvore original",
          },
        },
      },
    },
    {
      name: "issues_create_taxonomy_item",
      description:
        "Inclui um item na taxonomia compartilhada de issues e documentos, na raiz ou sob um item pai.",
      inputSchema: {
        type: "object",
        required: ["id", "label"],
        additionalProperties: false,
        properties: {
          id: {
            type: "string",
            description: "ID único e estável do novo item",
          },
          label: {
            type: "string",
            description: "Nome exibido do item",
          },
          parentId: {
            type: "string",
            description: "ID do item pai; quando omitido, inclui na raiz",
          },
          applicationIds: {
            type: "array",
            maxItems: 100,
            uniqueItems: true,
            items: {
              type: "string",
            },
            description:
              "Aplicações às quais o item se aplica; vazio significa todo o escopo permitido pelo pai. Quando omitido, herda a configuração explícita do pai",
          },
          workspaceId: {
            type: "string",
            description: "ID do workspace",
          },
        },
      },
    },
    {
      name: "issues_update_taxonomy_item",
      description:
        "Altera ou configura o nome e o escopo por aplicações de um item existente da taxonomia compartilhada.",
      inputSchema: {
        type: "object",
        required: ["taxonomyId"],
        additionalProperties: false,
        properties: {
          taxonomyId: {
            type: "string",
            description: "ID estável do item a alterar",
          },
          label: {
            type: "string",
            description: "Novo nome exibido",
          },
          applicationIds: {
            type: "array",
            maxItems: 100,
            uniqueItems: true,
            items: {
              type: "string",
            },
            description:
              "Novo escopo por aplicações; vazio significa todo o escopo permitido pelo pai",
          },
          workspaceId: {
            type: "string",
            description: "ID do workspace",
          },
        },
      },
    },
    {
      name: "issues_summary",
      description:
        "Retorna sumários de issues por data, semana, mês, ano, tipo, status e taxonomia.",
      inputSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          workspaceId: {
            type: "string",
            description: "ID público do workspace",
          },
          applicationId: {
            type: "string",
            description: "ID público da aplicação",
          },
          componentId: {
            type: "string",
            description: "ID de um componente afetado",
          },
          codigo: {
            type: "string",
          },
          code: {
            type: "string",
          },
          id: {
            type: "string",
          },
          tipo: {
            type: "string",
            description: "incident, request ou lista separada por vírgula",
          },
          type: {
            type: "string",
            description: "incident, request ou lista separada por vírgula",
          },
          status: {
            type: "string",
            description: "open, closed ou lista separada por vírgula",
          },
          texto: {
            type: "string",
          },
          text: {
            type: "string",
          },
          q: {
            type: "string",
          },
          title: {
            type: "string",
          },
          from: {
            type: "string",
            description: "YYYY-MM-DD",
          },
          to: {
            type: "string",
            description: "YYYY-MM-DD",
          },
          dateField: {
            type: "string",
            enum: [
              "receivedEmailAt",
              "issueCreatedAt",
              "firstThreadEmailAt",
              "closedAt",
              "updatedAt",
            ],
          },
          sort: {
            type: "string",
          },
          order: {
            type: "string",
            enum: ["asc", "desc"],
          },
          page: {
            type: "integer",
            minimum: 1,
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 100,
          },
        },
      },
    },
    {
      name: "issues_aggregate",
      description:
        "Retorna uma agregação específica de issues por date/day/week/month/year/type/status/taxonomy.",
      inputSchema: {
        type: "object",
        required: ["groupBy"],
        additionalProperties: true,
        properties: {
          workspaceId: {
            type: "string",
            description: "ID público do workspace",
          },
          applicationId: {
            type: "string",
            description: "ID público da aplicação",
          },
          componentId: {
            type: "string",
            description: "ID de um componente afetado",
          },
          codigo: {
            type: "string",
          },
          code: {
            type: "string",
          },
          id: {
            type: "string",
          },
          tipo: {
            type: "string",
            description: "incident, request ou lista separada por vírgula",
          },
          type: {
            type: "string",
            description: "incident, request ou lista separada por vírgula",
          },
          status: {
            type: "string",
            description: "open, closed ou lista separada por vírgula",
          },
          texto: {
            type: "string",
          },
          text: {
            type: "string",
          },
          q: {
            type: "string",
          },
          title: {
            type: "string",
          },
          from: {
            type: "string",
            description: "YYYY-MM-DD",
          },
          to: {
            type: "string",
            description: "YYYY-MM-DD",
          },
          dateField: {
            type: "string",
            enum: [
              "receivedEmailAt",
              "issueCreatedAt",
              "firstThreadEmailAt",
              "closedAt",
              "updatedAt",
            ],
          },
          sort: {
            type: "string",
          },
          order: {
            type: "string",
            enum: ["asc", "desc"],
          },
          page: {
            type: "integer",
            minimum: 1,
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 100,
          },
          groupBy: {
            type: "string",
            enum: [
              "date",
              "day",
              "week",
              "month",
              "year",
              "type",
              "status",
              "taxonomy",
            ],
          },
          interval: {
            type: "string",
            enum: ["day", "week", "month", "year"],
          },
        },
      },
    },
    {
      name: "issues_create",
      description: "Cria uma issue manual de suporte com origem MCP.",
      inputSchema: {
        type: "object",
        required: ["title", "text", "applicationId"],
        additionalProperties: false,
        properties: {
          identifier: {
            type: "string",
            maxLength: 100,
            description:
              "Identificador de negócio opcional, por exemplo INC12345",
          },
          id: {
            type: "string",
            description: "Opcional. Se omitido, será gerado um ID sintético.",
          },
          type: {
            type: "string",
            enum: ["incident", "request"],
            default: "incident",
          },
          status: {
            type: "string",
            enum: ["open", "closed"],
            default: "open",
          },
          title: {
            type: "string",
          },
          text: {
            type: "string",
          },
          date: {
            type: "string",
            description: "Data de referência. Default: agora.",
          },
          source: {
            type: "object",
            additionalProperties: true,
          },
          comment: {
            type: "string",
            description: "Comentário inicial opcional.",
          },
          workspaceId: {
            type: "string",
            description: "ID do workspace; validado contra a aplicação",
          },
          applicationId: {
            type: "string",
            description: "ID da aplicação relacionada",
          },
          affectedComponentIds: {
            type: "array",
            maxItems: 100,
            items: {
              type: "string",
            },
            description: "IDs de componentes ativos pertencentes à aplicação",
          },
        },
      },
    },
    {
      name: "issues_import_eml",
      description:
        "Analisa ou importa um arquivo EML na base de issues. Por segurança, dryRun é true por padrão.",
      inputSchema: {
        type: "object",
        required: ["filename", "contentBase64", "applicationId"],
        additionalProperties: false,
        properties: {
          filename: {
            type: "string",
            description: "Nome original terminado em .eml.",
          },
          contentBase64: {
            type: "string",
            description: "Conteúdo integral do EML codificado em Base64.",
          },
          dryRun: {
            type: "boolean",
            default: true,
            description: "Quando true, apenas mostra o que seria importado.",
          },
          type: {
            type: "string",
            enum: ["incident", "request"],
          },
          id: {
            type: "string",
            description: "ID explícito opcional.",
          },
          workspaceId: {
            type: "string",
            description: "ID do workspace; validado contra a aplicação",
          },
          applicationId: {
            type: "string",
            description: "ID da aplicação relacionada",
          },
          affectedComponentIds: {
            type: "array",
            maxItems: 100,
            items: {
              type: "string",
            },
            description: "IDs de componentes ativos pertencentes à aplicação",
          },
        },
      },
    },
    {
      name: "issues_update_state",
      description: "Altera status e/ou tipo de uma issue.",
      inputSchema: {
        type: "object",
        required: ["issueId"],
        additionalProperties: false,
        properties: {
          issueId: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["open", "closed"],
          },
          type: {
            type: "string",
            enum: ["incident", "request"],
          },
        },
      },
    },
    {
      name: "issues_suggest_taxonomy",
      description:
        "Busca lexical legada de taxonomias, mantida para compatibilidade. Para classificar, o agente deve ler os resources da issue e do catálogo da aplicação, analisar os dados e usar issues_classify quando autorizado.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          applicationId: {
            type: "string",
            description:
              "Aplicação usada para restringir as sugestões de taxonomia",
          },
          issueId: {
            type: "string",
          },
          title: {
            type: "string",
          },
          text: {
            type: "string",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            default: 5,
          },
        },
      },
    },
    {
      name: "issues_classify",
      description: "Grava classificação e resumo KB em uma issue.",
      inputSchema: {
        type: "object",
        required: ["issueId"],
        additionalProperties: false,
        properties: {
          issueId: {
            type: "string",
          },
          primaryTaxonomyId: {
            type: "string",
          },
          secondaryTaxonomyIds: {
            type: "array",
            items: {
              type: "string",
            },
          },
          summary: {
            type: "string",
          },
          tags: {
            type: "object",
            additionalProperties: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          updatedBy: {
            type: "string",
            default: "biaws-mcp",
          },
        },
      },
    },
    {
      name: "issues_by_taxonomy",
      description:
        "Busca issues classificadas em uma taxonomia principal ou secundária, incluindo suas taxonomias descendentes.",
      inputSchema: {
        type: "object",
        required: ["taxonomyId"],
        additionalProperties: false,
        properties: {
          taxonomyId: {
            type: "string",
          },
          status: {
            type: "string",
          },
          type: {
            type: "string",
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
            default: 25,
          },
          workspaceId: {
            type: "string",
            description: "ID público do workspace",
          },
          applicationId: {
            type: "string",
            description: "ID público da aplicação",
          },
          componentId: {
            type: "string",
            description: "ID de um componente afetado",
          },
        },
      },
    },
    {
      name: "demands_list",
      description:
        "Lista uma página de melhorias por status, texto, código e coleção. Texto e código parcial são filtrados antes da paginação; consultas com esses filtros percorrem até 100 páginas da API.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: {
            type: "string",
          },
          text: {
            type: "string",
          },
          code: {
            type: "string",
          },
          includeDetails: {
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
            default: 25,
          },
          collectionId: {
            type: "string",
            description: "ID da coleção; __root__ filtra melhorias na raiz.",
          },
          workspaceId: {
            type: "string",
            description: "ID público do workspace",
          },
          applicationId: {
            type: "string",
            description: "ID público da aplicação",
          },
          componentId: {
            type: "string",
            description: "ID de um componente afetado",
          },
        },
      },
    },
    {
      name: "demands_get",
      description:
        "Obtém uma melhoria estruturada com especificação, checklist, jornadas e notas.",
      inputSchema: {
        type: "object",
        required: ["requestId"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
          },
        },
      },
    },
    {
      name: "demands_create",
      description:
        "Cria uma melhoria no Bondia Workspaces com dados cadastrais, especificação técnica, checklist e planejamento de jornadas.",
      inputSchema: {
        type: "object",
        required: [
          "title",
          "description",
          "estimatedJourneys",
          "specificationSections",
          "applicationId",
        ],
        additionalProperties: false,
        properties: {
          clientCode: {
            type: "string",
            description: "Código da melhoria, se já definido",
          },
          collectionId: {
            type: "string",
            description: "Coleção de melhorias; vazio mantém na raiz",
          },
          title: {
            type: "string",
          },
          status: {
            type: "string",
            description:
              "Status configurado em Configurações/Listas de Opções; a API valida o valor vigente.",
          },
          estimatedDeliveryDate: {
            type: "string",
            description: "YYYY-MM-DD ou vazio",
          },
          startDate: {
            type: "string",
            description: "YYYY-MM-DD ou vazio",
          },
          endDate: {
            type: "string",
            description: "YYYY-MM-DD ou vazio",
          },
          estimatedJourneys: {
            type: "number",
            minimum: 0,
          },
          description: {
            type: "string",
            description: "Descrição sucinta da melhoria",
          },
          specificationSections: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["id", "title", "content", "order"],
              additionalProperties: false,
              properties: {
                id: {
                  type: "string",
                },
                title: {
                  type: "string",
                },
                content: {
                  type: "string",
                  description: "Conteúdo em Markdown",
                },
                order: {
                  type: "integer",
                  minimum: 0,
                },
              },
            },
          },
          checklist: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "done"],
              additionalProperties: false,
              properties: {
                label: {
                  type: "string",
                },
                done: {
                  type: "boolean",
                },
                date: {
                  type: "string",
                  description: "YYYY-MM-DD ou vazio",
                },
                comment: {
                  type: "string",
                },
              },
            },
          },
          journeys: {
            type: "array",
            items: {
              type: "object",
              required: ["month", "plannedJourneys"],
              additionalProperties: false,
              properties: {
                month: {
                  type: "string",
                  description: "YYYY-MM",
                },
                plannedJourneys: {
                  type: "number",
                  minimum: 0,
                },
                executedJourneys: {
                  type: "number",
                  minimum: 0,
                  default: 0,
                },
                comment: {
                  type: "string",
                },
              },
            },
          },
          workspaceId: {
            type: "string",
            description: "ID do workspace; validado contra a aplicação",
          },
          applicationId: {
            type: "string",
            description: "ID da aplicação relacionada",
          },
          affectedComponentIds: {
            type: "array",
            maxItems: 100,
            items: {
              type: "string",
            },
            description: "IDs de componentes ativos pertencentes à aplicação",
          },
        },
      },
    },
    {
      name: "demands_journey_calendar",
      description: "Consolida o calendário de jornadas das melhorias por mês.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          fromMonth: {
            type: "string",
            description: "YYYY-MM",
          },
          toMonth: {
            type: "string",
            description: "YYYY-MM",
          },
          status: {
            type: "string",
          },
          collectionId: {
            type: "string",
            description: "ID da coleção ou __root__.",
          },
          workspaceId: {
            type: "string",
            description: "ID público do workspace",
          },
          applicationId: {
            type: "string",
            description: "ID público da aplicação",
          },
          componentId: {
            type: "string",
            description: "ID de um componente afetado",
          },
        },
      },
    },
    {
      name: "demands_deadlines",
      description:
        "Retorna prazos, status e indicadores de atraso das melhorias.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: {
            type: "string",
          },
          referenceDate: {
            type: "string",
            description: "YYYY-MM-DD. Default: hoje.",
          },
          collectionId: {
            type: "string",
            description: "ID da coleção ou __root__.",
          },
          workspaceId: {
            type: "string",
            description: "ID público do workspace",
          },
          applicationId: {
            type: "string",
            description: "ID público da aplicação",
          },
          componentId: {
            type: "string",
            description: "ID de um componente afetado",
          },
        },
      },
    },
    {
      name: "demands_implementation_context",
      description:
        "Extrai contexto estruturado da melhoria para um agente executar implementação/desenvolvimento.",
      inputSchema: {
        type: "object",
        required: ["requestId"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
          },
          includeNotes: {
            type: "boolean",
            default: true,
          },
        },
      },
    },
    {
      name: "demands_add_note",
      description: "Adiciona uma anotação operacional à melhoria.",
      inputSchema: {
        type: "object",
        required: ["requestId", "content"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
          },
          date: {
            type: "string",
            description: "YYYY-MM-DD. Default: hoje.",
          },
          content: {
            type: "string",
          },
        },
      },
    },
    {
      name: "demands_update_description",
      description: "Atualiza a descrição sucinta de uma melhoria.",
      inputSchema: {
        type: "object",
        required: ["requestId", "description"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
          },
          description: {
            type: "string",
          },
        },
      },
    },
    {
      name: "demands_list_tasks",
      description:
        "Lista as tarefas de uma melhoria, opcionalmente filtradas por status.",
      inputSchema: {
        type: "object",
        required: ["requestId"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
            description: "ID ou código da melhoria",
          },
          status: {
            type: "string",
            description:
              "Status configurado em Configurações/Listas de Opções; a API valida o valor vigente.",
          },
        },
      },
    },
    {
      name: "demands_create_task",
      description: "Inclui uma tarefa na melhoria.",
      inputSchema: {
        type: "object",
        required: ["requestId", "title"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
            description: "ID ou código da melhoria",
          },
          code: {
            type: "string",
            description: "Código opcional da tarefa",
          },
          title: {
            type: "string",
          },
          status: {
            type: "string",
            description:
              "Status configurado em Configurações/Listas de Opções; a API valida o valor vigente.",
          },
          startDate: {
            type: "string",
            description: "YYYY-MM-DD ou vazio",
          },
          endDate: {
            type: "string",
            description: "YYYY-MM-DD ou vazio",
          },
          situation: {
            type: "string",
            description:
              "Resumo em texto livre do que precisa ser feito na tarefa",
          },
          description: {
            type: "string",
            description: "Descrição em Markdown",
          },
          specification: {
            type: "string",
            description: "Especificação em Markdown",
          },
        },
      },
    },
    {
      name: "demands_update_task",
      description: "Altera os dados de uma tarefa existente da melhoria.",
      inputSchema: {
        type: "object",
        required: ["requestId", "taskId"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
            description: "ID ou código da melhoria",
          },
          taskId: {
            type: "string",
          },
          code: {
            type: "string",
            description: "Código opcional da tarefa",
          },
          title: {
            type: "string",
          },
          status: {
            type: "string",
            description:
              "Status configurado em Configurações/Listas de Opções; a API valida o valor vigente.",
          },
          startDate: {
            type: "string",
            description: "YYYY-MM-DD ou vazio",
          },
          endDate: {
            type: "string",
            description: "YYYY-MM-DD ou vazio",
          },
          situation: {
            type: "string",
            description:
              "Resumo em texto livre do que precisa ser feito na tarefa",
          },
          description: {
            type: "string",
            description: "Descrição em Markdown",
          },
          specification: {
            type: "string",
            description: "Especificação em Markdown",
          },
        },
      },
    },
    {
      name: "demands_update_task_status",
      description:
        "Altera somente o status de uma tarefa da melhoria. Requer um status válido declarado no schema.",
      inputSchema: {
        type: "object",
        required: ["requestId", "taskId", "status"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
            description: "ID ou código da melhoria",
          },
          taskId: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["Pendente", "Andamento", "Aguardando Decisão", "Concluído"],
            description:
              "Status válido da tarefa. Use exatamente um dos valores declarados no enum.",
          },
        },
      },
    },
    {
      name: "demands_delete_task",
      description: "Exclui uma tarefa da melhoria.",
      inputSchema: {
        type: "object",
        required: ["requestId", "taskId"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
            description: "ID ou código da melhoria",
          },
          taskId: {
            type: "string",
          },
        },
      },
    },
    {
      name: "demands_add_task_note",
      description: "Adiciona uma nota de execução a uma tarefa da melhoria.",
      inputSchema: {
        type: "object",
        required: ["requestId", "taskId", "content"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
            description: "ID ou código da melhoria",
          },
          taskId: {
            type: "string",
          },
          date: {
            type: "string",
            description: "YYYY-MM-DD. Default: hoje.",
          },
          content: {
            type: "string",
            description: "Nota em Markdown",
          },
        },
      },
    },
    {
      name: "demands_update_task_note",
      description: "Altera uma nota de execução de uma tarefa da melhoria.",
      inputSchema: {
        type: "object",
        required: ["requestId", "taskId", "noteId", "content"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
            description: "ID ou código da melhoria",
          },
          taskId: {
            type: "string",
          },
          noteId: {
            type: "string",
          },
          date: {
            type: "string",
            description: "YYYY-MM-DD. Default: hoje.",
          },
          content: {
            type: "string",
            description: "Nota em Markdown",
          },
        },
      },
    },
    {
      name: "demands_delete_task_note",
      description: "Exclui uma nota de execução de uma tarefa da melhoria.",
      inputSchema: {
        type: "object",
        required: ["requestId", "taskId", "noteId"],
        additionalProperties: false,
        properties: {
          requestId: {
            type: "string",
            description: "ID ou código da melhoria",
          },
          taskId: {
            type: "string",
          },
          noteId: {
            type: "string",
          },
        },
      },
    },
  ],
] as const satisfies readonly ToolDefinition[];
