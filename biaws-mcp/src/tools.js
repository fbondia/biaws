import {
  classifyIssue,
  createTaxonomyItem,
  createIssue,
  importEml,
  findIssuesByTaxonomy,
  getIssueClassificationCatalog,
  getIssueDetails,
  searchIssues,
  summarizeIssuesForSupport,
  suggestTaxonomy,
  updateIssueState,
  updateTaxonomyItem,
} from "./domains/issues/service.js";
import {
  addDemandNote,
  addDemandTaskNote,
  createDemand,
  createDemandTask,
  deleteDemandTask,
  deleteDemandTaskNote,
  getJourneyCalendar,
  getDemand,
  getDemandImplementationContext,
  getDemandDeadlines,
  listDemands,
  listDemandTasks,
  updateDemandDescription,
  updateDemandTask,
  updateDemandTaskStatus,
  updateDemandTaskNote,
} from "./domains/demands/service.js";
import {
  createProcedure,
  getProcedureClassificationCatalog,
  searchProcedures,
  updateProcedure,
} from "./domains/procedures/service.js";
import { catalogTools } from "./domains/catalog/tools.js";
import { collectionTools } from "./domains/collections/tools.js";
import { secretTools } from "./domains/secrets/tools.js";
import { knowledgeTools } from "./domains/knowledge/tools.js";
import { attachmentTools } from "./domains/attachments/tools.js";

const DEMAND_TASK_STATUS_SCHEMA = {
  type: "string",
  description:
    "Status configurado em Configurações/Listas de Opções; a API valida o valor vigente.",
};

const DEMAND_TASK_FIELDS = {
  code: { type: "string", description: "Código opcional da tarefa" },
  title: { type: "string" },
  status: DEMAND_TASK_STATUS_SCHEMA,
  startDate: { type: "string", description: "YYYY-MM-DD ou vazio" },
  endDate: { type: "string", description: "YYYY-MM-DD ou vazio" },
  situation: {
    type: "string",
    description: "Resumo em texto livre do que precisa ser feito na tarefa",
  },
  description: { type: "string", description: "Descrição em Markdown" },
  specification: { type: "string", description: "Especificação em Markdown" },
};

const DEMAND_STATUS_SCHEMA = {
  type: "string",
  description:
    "Status configurado em Configurações/Listas de Opções; a API valida o valor vigente.",
};

const KNOWLEDGE_CONTEXT_FILTER_PROPERTIES = {
  workspaceId: { type: "string", description: "ID público do workspace" },
  applicationId: { type: "string", description: "ID público da aplicação" },
  componentId: {
    type: "string",
    description: "ID de um componente afetado",
  },
};

const KNOWLEDGE_CONTEXT_MUTATION_PROPERTIES = {
  workspaceId: {
    type: "string",
    description: "ID do workspace; validado contra a aplicação",
  },
  applicationId: { type: "string", description: "ID da aplicação relacionada" },
  affectedComponentIds: {
    type: "array",
    maxItems: 100,
    items: { type: "string" },
    description: "IDs de componentes ativos pertencentes à aplicação",
  },
};

const ISSUE_FILTER_PROPERTIES = {
  ...KNOWLEDGE_CONTEXT_FILTER_PROPERTIES,
  codigo: { type: "string" },
  code: { type: "string" },
  id: { type: "string" },
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
  texto: { type: "string" },
  text: { type: "string" },
  q: { type: "string" },
  title: { type: "string" },
  from: { type: "string", description: "YYYY-MM-DD" },
  to: { type: "string", description: "YYYY-MM-DD" },
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
  sort: { type: "string" },
  order: { type: "string", enum: ["asc", "desc"] },
  page: { type: "integer", minimum: 1 },
  limit: { type: "integer", minimum: 1, maximum: 100 },
};

const PROCEDURE_CLASSIFICATION_PROPERTIES = {
  primaryTaxonomyId: { type: "string", description: "ID do assunto principal" },
  secondaryTaxonomyIds: {
    type: "array",
    items: { type: "string" },
    description: "IDs dos assuntos secundários",
  },
  tags: {
    type: "object",
    description: "Tags por grupo, no mesmo formato da classificação de issues",
    additionalProperties: { type: "array", items: { type: "string" } },
  },
};

const tools = [
  ...catalogTools,
  ...collectionTools,
  ...secretTools,
  ...knowledgeTools,
  ...attachmentTools,
  {
    name: "issues_search",
    description:
      "Busca issues de suporte com filtros por código, texto, tipo, status, datas, tags, paginação e ordenação.",
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: ISSUE_FILTER_PROPERTIES,
    },
    handler: searchIssues,
  },
  {
    name: "issues_get",
    description: "Obtém uma issue com comentários e anexos.",
    inputSchema: {
      type: "object",
      required: ["issueId"],
      additionalProperties: false,
      properties: {
        issueId: { type: "string" },
      },
    },
    handler: getIssueDetails,
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
    handler: getIssueClassificationCatalog,
  },
  {
    name: "issues_create_taxonomy_item",
    description:
      "Inclui um item na taxonomia compartilhada de issues e procedimentos, na raiz ou sob um item pai.",
    inputSchema: {
      type: "object",
      required: ["id", "label"],
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description: "ID único e estável do novo item",
        },
        label: { type: "string", description: "Nome exibido do item" },
        parentId: {
          type: "string",
          description: "ID do item pai; quando omitido, inclui na raiz",
        },
        applicationIds: {
          type: "array",
          maxItems: 100,
          uniqueItems: true,
          items: { type: "string" },
          description:
            "Aplicações às quais o item se aplica; vazio significa todo o escopo permitido pelo pai. Quando omitido, herda a configuração explícita do pai",
        },
        workspaceId: { type: "string", description: "ID do workspace" },
      },
    },
    handler: createTaxonomyItem,
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
        label: { type: "string", description: "Novo nome exibido" },
        applicationIds: {
          type: "array",
          maxItems: 100,
          uniqueItems: true,
          items: { type: "string" },
          description:
            "Novo escopo por aplicações; vazio significa todo o escopo permitido pelo pai",
        },
        workspaceId: { type: "string", description: "ID do workspace" },
      },
    },
    handler: updateTaxonomyItem,
  },
  {
    name: "issues_summary",
    description:
      "Retorna sumários de issues por data, semana, mês, ano, tipo, status e taxonomia.",
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: ISSUE_FILTER_PROPERTIES,
    },
    handler: summarizeIssuesForSupport,
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
        ...ISSUE_FILTER_PROPERTIES,
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
    handler: summarizeIssuesForSupport,
  },
  {
    name: "issues_create",
    description: "Cria uma issue manual de suporte com origem MCP.",
    inputSchema: {
      type: "object",
      required: ["title", "text", "applicationId"],
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description: "Opcional. Se omitido, será gerado um ID sintético.",
        },
        type: {
          type: "string",
          enum: ["incident", "request"],
          default: "incident",
        },
        status: { type: "string", enum: ["open", "closed"], default: "open" },
        title: { type: "string" },
        text: { type: "string" },
        date: {
          type: "string",
          description: "Data de referência. Default: agora.",
        },
        source: { type: "object", additionalProperties: true },
        comment: {
          type: "string",
          description: "Comentário inicial opcional.",
        },
        ...KNOWLEDGE_CONTEXT_MUTATION_PROPERTIES,
      },
    },
    handler: createIssue,
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
        type: { type: "string", enum: ["incident", "request"] },
        id: { type: "string", description: "ID explícito opcional." },
        ...KNOWLEDGE_CONTEXT_MUTATION_PROPERTIES,
      },
    },
    handler: importEml,
  },
  {
    name: "issues_update_state",
    description: "Altera status e/ou tipo de uma issue.",
    inputSchema: {
      type: "object",
      required: ["issueId"],
      additionalProperties: false,
      properties: {
        issueId: { type: "string" },
        status: { type: "string", enum: ["open", "closed"] },
        type: { type: "string", enum: ["incident", "request"] },
      },
    },
    handler: updateIssueState,
  },
  {
    name: "issues_suggest_taxonomy",
    description:
      "Sugere taxonomias aderentes ao texto/título de uma issue ou texto livre.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          description:
            "Aplicação usada para restringir as sugestões de taxonomia",
        },
        issueId: { type: "string" },
        title: { type: "string" },
        text: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
    },
    handler: suggestTaxonomy,
  },
  {
    name: "issues_classify",
    description: "Grava classificação e resumo KB em uma issue.",
    inputSchema: {
      type: "object",
      required: ["issueId"],
      additionalProperties: false,
      properties: {
        issueId: { type: "string" },
        primaryTaxonomyId: { type: "string" },
        secondaryTaxonomyIds: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        tags: {
          type: "object",
          additionalProperties: { type: "array", items: { type: "string" } },
        },
        updatedBy: { type: "string", default: "biaws-mcp" },
      },
    },
    handler: classifyIssue,
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
        taxonomyId: { type: "string" },
        status: { type: "string" },
        type: { type: "string" },
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        ...KNOWLEDGE_CONTEXT_FILTER_PROPERTIES,
      },
    },
    handler: findIssuesByTaxonomy,
  },
  {
    name: "procedures_search",
    description:
      "Pesquisa procedimentos pelo ID ou por texto no título, sumário e conteúdo Markdown.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        procedureId: {
          type: "string",
          description:
            "Quando informado, retorna diretamente o procedimento pelo ID",
        },
        search: {
          type: "string",
          description: "Texto pesquisado no título, sumário e conteúdo",
        },
        text: { type: "string", description: "Alias de search" },
        q: { type: "string", description: "Alias de search" },
        taxonomyId: {
          type: "string",
          description:
            "Assunto principal ou secundário associado ao procedimento, incluindo seus descendentes",
        },
        tagGroupId: {
          type: "string",
          description:
            "ID do grupo da tag; obrigatório quando tagId for informado",
        },
        tagId: { type: "string", description: "Tag associada ao procedimento" },
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        ...KNOWLEDGE_CONTEXT_FILTER_PROPERTIES,
      },
    },
    handler: searchProcedures,
  },
  {
    name: "procedures_get_classification_catalog",
    description:
      "Obtém a estrutura classificatória compartilhada de taxonomia e tags para orientar pesquisas e classificações de procedimentos.",
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
    handler: getProcedureClassificationCatalog,
  },
  {
    name: "procedures_create",
    description:
      "Cria um procedimento em Markdown, opcionalmente classificado com os mesmos assuntos e tags das issues.",
    inputSchema: {
      type: "object",
      required: ["title", "summary", "procedure"],
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        summary: {
          type: "string",
          description: "Resumo sucinto exibido na lista de procedimentos",
        },
        procedure: {
          type: "string",
          description: "Descrição integral do procedimento em Markdown",
        },
        ...PROCEDURE_CLASSIFICATION_PROPERTIES,
        ...KNOWLEDGE_CONTEXT_MUTATION_PROPERTIES,
      },
    },
    handler: createProcedure,
  },
  {
    name: "procedures_update",
    description:
      "Atualiza parcialmente título, conteúdo ou classificação de um procedimento existente.",
    inputSchema: {
      type: "object",
      required: ["procedureId"],
      additionalProperties: false,
      properties: {
        procedureId: { type: "string" },
        title: { type: "string" },
        summary: {
          type: "string",
          description: "Resumo sucinto exibido na lista de procedimentos",
        },
        procedure: {
          type: "string",
          description: "Descrição integral do procedimento em Markdown",
        },
        ...PROCEDURE_CLASSIFICATION_PROPERTIES,
        ...KNOWLEDGE_CONTEXT_MUTATION_PROPERTIES,
      },
    },
    handler: updateProcedure,
  },
  {
    name: "demands_list",
    description:
      "Lista melhorias com filtros simples por status, texto e código.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string" },
        text: { type: "string" },
        code: { type: "string" },
        includeDetails: { type: "boolean", default: false },
        ...KNOWLEDGE_CONTEXT_FILTER_PROPERTIES,
      },
    },
    handler: listDemands,
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
        requestId: { type: "string" },
      },
    },
    handler: getDemand,
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
        title: { type: "string" },
        status: DEMAND_STATUS_SCHEMA,
        estimatedDeliveryDate: {
          type: "string",
          description: "YYYY-MM-DD ou vazio",
        },
        startDate: { type: "string", description: "YYYY-MM-DD ou vazio" },
        endDate: { type: "string", description: "YYYY-MM-DD ou vazio" },
        estimatedJourneys: { type: "number", minimum: 0 },
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
              id: { type: "string" },
              title: { type: "string" },
              content: { type: "string", description: "Conteúdo em Markdown" },
              order: { type: "integer", minimum: 0 },
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
              label: { type: "string" },
              done: { type: "boolean" },
              date: { type: "string", description: "YYYY-MM-DD ou vazio" },
              comment: { type: "string" },
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
              month: { type: "string", description: "YYYY-MM" },
              plannedJourneys: { type: "number", minimum: 0 },
              executedJourneys: { type: "number", minimum: 0, default: 0 },
              comment: { type: "string" },
            },
          },
        },
        ...KNOWLEDGE_CONTEXT_MUTATION_PROPERTIES,
      },
    },
    handler: createDemand,
  },
  {
    name: "demands_journey_calendar",
    description: "Consolida o calendário de jornadas das melhorias por mês.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        fromMonth: { type: "string", description: "YYYY-MM" },
        toMonth: { type: "string", description: "YYYY-MM" },
        status: { type: "string" },
        ...KNOWLEDGE_CONTEXT_FILTER_PROPERTIES,
      },
    },
    handler: getJourneyCalendar,
  },
  {
    name: "demands_deadlines",
    description:
      "Retorna prazos, status e indicadores de atraso das melhorias.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string" },
        referenceDate: {
          type: "string",
          description: "YYYY-MM-DD. Default: hoje.",
        },
        ...KNOWLEDGE_CONTEXT_FILTER_PROPERTIES,
      },
    },
    handler: getDemandDeadlines,
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
        requestId: { type: "string" },
        includeNotes: { type: "boolean", default: true },
      },
    },
    handler: getDemandImplementationContext,
  },
  {
    name: "demands_add_note",
    description: "Adiciona uma anotação operacional à melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "content"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD. Default: hoje." },
        content: { type: "string" },
      },
    },
    handler: addDemandNote,
  },
  {
    name: "demands_update_description",
    description: "Atualiza a descrição sucinta de uma melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "description"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string" },
        description: { type: "string" },
      },
    },
    handler: updateDemandDescription,
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
        requestId: { type: "string", description: "ID ou código da melhoria" },
        status: DEMAND_TASK_STATUS_SCHEMA,
      },
    },
    handler: listDemandTasks,
  },
  {
    name: "demands_create_task",
    description: "Inclui uma tarefa na melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "title"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string", description: "ID ou código da melhoria" },
        ...DEMAND_TASK_FIELDS,
      },
    },
    handler: createDemandTask,
  },
  {
    name: "demands_update_task",
    description: "Altera os dados de uma tarefa existente da melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "taskId"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string", description: "ID ou código da melhoria" },
        taskId: { type: "string" },
        ...DEMAND_TASK_FIELDS,
      },
    },
    handler: updateDemandTask,
  },
  {
    name: "demands_update_task_status",
    description: "Altera somente o status de uma tarefa da melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "taskId", "status"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string", description: "ID ou código da melhoria" },
        taskId: { type: "string" },
        status: DEMAND_TASK_STATUS_SCHEMA,
      },
    },
    handler: updateDemandTaskStatus,
  },
  {
    name: "demands_delete_task",
    description: "Exclui uma tarefa da melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "taskId"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string", description: "ID ou código da melhoria" },
        taskId: { type: "string" },
      },
    },
    handler: deleteDemandTask,
  },
  {
    name: "demands_add_task_note",
    description: "Adiciona uma nota de execução a uma tarefa da melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "taskId", "content"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string", description: "ID ou código da melhoria" },
        taskId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD. Default: hoje." },
        content: { type: "string", description: "Nota em Markdown" },
      },
    },
    handler: addDemandTaskNote,
  },
  {
    name: "demands_update_task_note",
    description: "Altera uma nota de execução de uma tarefa da melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "taskId", "noteId", "content"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string", description: "ID ou código da melhoria" },
        taskId: { type: "string" },
        noteId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD. Default: hoje." },
        content: { type: "string", description: "Nota em Markdown" },
      },
    },
    handler: updateDemandTaskNote,
  },
  {
    name: "demands_delete_task_note",
    description: "Exclui uma nota de execução de uma tarefa da melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "taskId", "noteId"],
      additionalProperties: false,
      properties: {
        requestId: { type: "string", description: "ID ou código da melhoria" },
        taskId: { type: "string" },
        noteId: { type: "string" },
      },
    },
    handler: deleteDemandTaskNote,
  },
];

const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

function valueMatchesType(value, type) {
  if (Array.isArray(type))
    return type.some((candidate) => valueMatchesType(value, candidate));
  if (type === "null") return value === null;
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number")
    return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function addValidationField(fields, path, code, message) {
  fields.push({ path, code, message });
}

function validateSchemaType(value, schema, path, fields) {
  if (!schema.type || valueMatchesType(value, schema.type)) return true;
  const expected = Array.isArray(schema.type)
    ? schema.type.join(" or ")
    : schema.type;
  addValidationField(
    fields,
    path,
    "invalid_type",
    `${path} must be of type ${expected}`,
  );
  return false;
}

function validateEnum(value, schema, path, fields) {
  if (schema.enum && !schema.enum.includes(value)) {
    addValidationField(
      fields,
      path,
      "invalid_enum",
      `${path} must be one of ${schema.enum.join(", ")}`,
    );
  }
}

function validateNumber(value, schema, path, fields) {
  if (typeof value !== "number") return;
  if (schema.minimum !== undefined && value < schema.minimum) {
    addValidationField(
      fields,
      path,
      "minimum",
      `${path} must be at least ${schema.minimum}`,
    );
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    addValidationField(
      fields,
      path,
      "maximum",
      `${path} must be at most ${schema.maximum}`,
    );
  }
}

function validateArray(value, schema, path, fields) {
  if (!Array.isArray(value)) return;
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    addValidationField(
      fields,
      path,
      "min_items",
      `${path} must contain at least ${schema.minItems} items`,
    );
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    addValidationField(
      fields,
      path,
      "max_items",
      `${path} must contain at most ${schema.maxItems} items`,
    );
  }
  for (const [index, entry] of value.entries()) {
    validateValue(entry, schema.items, `${path}[${index}]`, fields);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isObjectSchema(value) {
  return Boolean(value) && typeof value === "object";
}

function validateRequiredProperties(value, schema, path, fields) {
  for (const required of schema.required || []) {
    if (value[required] === undefined) {
      const requiredPath = path ? `${path}.${required}` : required;
      addValidationField(
        fields,
        requiredPath,
        "required",
        `${requiredPath} is required`,
      );
    }
  }
}

function validateObjectEntries(value, schema, path, fields) {
  const properties = schema.properties || {};
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = path ? `${path}.${key}` : key;
    if (properties[key]) {
      validateValue(entry, properties[key], entryPath, fields);
    } else if (schema.additionalProperties === false) {
      addValidationField(
        fields,
        entryPath,
        "additional_property",
        `${entryPath} is not supported`,
      );
    } else if (isObjectSchema(schema.additionalProperties)) {
      validateValue(entry, schema.additionalProperties, entryPath, fields);
    }
  }
}

function validateObject(value, schema, path, fields) {
  if (!isPlainObject(value)) return;
  validateRequiredProperties(value, schema, path, fields);
  validateObjectEntries(value, schema, path, fields);
}

function validateValue(value, schema, path, fields) {
  if (!schema || value === undefined) return;
  if (!validateSchemaType(value, schema, path, fields)) return;
  validateEnum(value, schema, path, fields);
  validateNumber(value, schema, path, fields);
  validateArray(value, schema, path, fields);
  validateObject(value, schema, path, fields);
}

function validateArguments(tool, args) {
  const fields = [];
  validateValue(args, tool.inputSchema, "", fields);
  if (!fields.length) return;

  const error = new Error(fields.map(({ message }) => message).join("; "));
  error.code = "VALIDATION_ERROR";
  error.statusCode = 400;
  error.fields = fields;
  error.retryable = false;
  throw error;
}

export function listTools() {
  return tools.map(({ handler, ...tool }) => tool);
}

export async function dispatchTool(name, args) {
  const tool = toolByName.get(name);
  if (!tool) {
    const error = new Error(`Unknown tool: ${name}`);
    error.code = "TOOL_NOT_FOUND";
    error.statusCode = 404;
    error.retryable = false;
    throw error;
  }
  validateArguments(tool, args);
  return tool.handler(args);
}
