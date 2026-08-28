import {
  addDocumentObservation,
  createDocument,
  getDocument,
  listDocumentTypes,
  loadKnowledgeContext,
  searchDocuments,
  updateDocument,
} from "./service.js";
import {
  DOCUMENT_TYPE_CATALOG,
  DOCUMENT_TYPES,
} from "./documentTypeCatalog.js";

const ID = { type: "string", minLength: 1 };
const DATE = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  description: "Data no formato YYYY-MM-DD.",
};
const DOCUMENT_TYPE = {
  type: "string",
  enum: DOCUMENT_TYPES,
  description:
    "Tipo imutável do documento. Consulte document_types_list para o contrato completo.",
};
const REFERENCES = {
  type: "array",
  maxItems: 100,
  description: "Relações com outros documentos do mesmo workspace.",
  items: {
    type: "object",
    required: ["targetDocumentId"],
    additionalProperties: false,
    properties: {
      targetDocumentId: ID,
      relationship: {
        type: "string",
        maxLength: 80,
        description: "Tipo da relação; usa related quando omitido.",
      },
    },
  },
};
const SOURCE = {
  type: "object",
  description:
    "Origem canônica. Em mode=repository, repositoryId e path são obrigatórios.",
  additionalProperties: false,
  properties: {
    mode: { type: "string", enum: ["native", "repository"] },
    repositoryId: { type: "string", maxLength: 160 },
    path: { type: "string", maxLength: 500 },
  },
  oneOf: [
    {
      properties: { mode: { const: "native" } },
      required: ["mode"],
    },
    {
      properties: { mode: { const: "repository" } },
      required: ["mode", "repositoryId", "path"],
    },
  ],
};
const CLASSIFICATION = {
  type: "object",
  description: "Taxonomias e tags aplicáveis ao contexto do documento.",
  additionalProperties: false,
  properties: {
    primaryTaxonomyId: { type: "string" },
    secondaryTaxonomyIds: { type: "array", items: ID },
    tags: {
      type: "object",
      additionalProperties: { type: "array", items: ID },
    },
  },
};

function detailProperty(definition) {
  if (definition.type === "date") return DATE;
  return {
    type: definition.type,
    ...(definition.enum ? { enum: definition.enum } : {}),
    ...(definition.maxLength ? { maxLength: definition.maxLength } : {}),
    ...(definition.default !== undefined
      ? { default: definition.default }
      : {}),
  };
}

function detailsSchema(type, scope) {
  const config = DOCUMENT_TYPE_CATALOG[type];
  const properties = Object.fromEntries(
    Object.entries(config.details).map(([field, definition]) => [
      field,
      detailProperty(definition),
    ]),
  );
  if (scope) properties.scope = { const: scope };
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(scope ? { required: ["scope"] } : {}),
  };
}

const ALL_STATUSES = [
  ...new Set(
    Object.values(DOCUMENT_TYPE_CATALOG).flatMap(({ statuses }) => statuses),
  ),
];

const COMMON = {
  identifier: {
    type: "string",
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    maxLength: 80,
    description:
      "Identificador opcional e único no workspace, usando minúsculas, números e hífens simples.",
  },
  documentType: DOCUMENT_TYPE,
  title: { ...ID, maxLength: 240 },
  summary: { type: "string", minLength: 1, maxLength: 500 },
  markdown: ID,
  applicationId: {
    type: "string",
    minLength: 1,
    description:
      "Obrigatório para regras, decisões, features e documentos cujo escopo seja aplicação ou componente; omita no escopo do workspace.",
  },
  affectedComponentIds: {
    type: "array",
    maxItems: 100,
    items: ID,
    description:
      "Componentes ativos da applicationId. Não pode ser informado sem aplicação.",
  },
  collectionId: { type: "string" },
  status: {
    type: "string",
    enum: ALL_STATUSES,
    description:
      "Estado válido para o documentType; quando omitido, usa o estado inicial do tipo.",
  },
  details: {
    type: "object",
    description:
      "Metadados específicos do documentType, validados pelo ramo correspondente do schema.",
  },
  classification: CLASSIFICATION,
  source: SOURCE,
  references: REFERENCES,
  definedAt: DATE,
  lastReviewedAt: {
    type: "string",
    description: "YYYY-MM-DD ou vazio.",
  },
  nextReviewAt: { type: "string", description: "YYYY-MM-DD ou vazio." },
  changeSummary: { type: "string" },
};

function typeBranch(type) {
  const config = DOCUMENT_TYPE_CATALOG[type];
  return {
    description: `${config.label}: ${config.description}`,
    properties: {
      documentType: { const: type },
      status: { type: "string", enum: config.statuses },
      details: detailsSchema(type),
    },
    required: [
      "documentType",
      ...(config.applicationRequired ? ["applicationId"] : []),
    ],
  };
}

function optionalApplicationBranches(type) {
  const config = DOCUMENT_TYPE_CATALOG[type];
  const properties = {
    documentType: { const: type },
    status: { type: "string", enum: config.statuses },
    details: detailsSchema(type),
  };
  return [
    {
      description: `${config.label} geral do workspace; applicationId e componentes devem ser omitidos.`,
      properties: {
        ...properties,
        applicationId: { const: null },
        affectedComponentIds: { type: "array", maxItems: 0 },
      },
      required: ["documentType"],
    },
    {
      description: `${config.label} vinculada a uma aplicação e, opcionalmente, a seus componentes.`,
      properties,
      required: ["documentType", "applicationId"],
    },
  ];
}

const CREATE_VARIANTS = [
  typeBranch("business-rule"),
  typeBranch("architecture-decision"),
  typeBranch("feature"),
  ...optionalApplicationBranches("technical-reference"),
  ...optionalApplicationBranches("procedure"),
  {
    description:
      "Guideline geral do workspace; applicationId deve ser omitido.",
    properties: {
      documentType: { const: "guideline" },
      status: {
        type: "string",
        enum: DOCUMENT_TYPE_CATALOG.guideline.statuses,
      },
      details: detailsSchema("guideline", "workspace"),
      applicationId: { const: null },
      affectedComponentIds: { type: "array", maxItems: 0 },
    },
    required: ["documentType", "details"],
  },
  {
    description: "Guideline vinculada a uma aplicação.",
    properties: {
      documentType: { const: "guideline" },
      status: {
        type: "string",
        enum: DOCUMENT_TYPE_CATALOG.guideline.statuses,
      },
      details: detailsSchema("guideline", "application"),
    },
    required: ["documentType", "details", "applicationId"],
  },
  {
    description: "Guideline vinculada a ao menos um componente da aplicação.",
    properties: {
      documentType: { const: "guideline" },
      status: {
        type: "string",
        enum: DOCUMENT_TYPE_CATALOG.guideline.statuses,
      },
      details: detailsSchema("guideline", "component"),
      affectedComponentIds: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: ID,
      },
    },
    required: [
      "documentType",
      "details",
      "applicationId",
      "affectedComponentIds",
    ],
  },
];

function schema(properties, required = [], extra = {}) {
  return {
    type: "object",
    ...(required.length ? { required } : {}),
    additionalProperties: false,
    properties,
    ...extra,
  };
}

function definition(name, description, handler, inputSchema) {
  return { name, description, handler, inputSchema };
}

export const knowledgeTools = [
  definition(
    "knowledge_context_load",
    "Carrega documentos vigentes aplicáveis a uma aplicação ou componente, com Markdown opcional.",
    loadKnowledgeContext,
    schema(
      {
        applicationId: ID,
        componentId: ID,
        includeMarkdown: { type: "boolean", default: true },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      ["applicationId"],
    ),
  ),
  definition(
    "document_types_list",
    "Lista o contrato oficial de cada tipo de documento: contexto exigido, estados e campos details.",
    listDocumentTypes,
    schema({}),
  ),
  definition(
    "documents_search",
    "Busca documentos por tipo, aplicação, componente, coleção, estado ou texto.",
    searchDocuments,
    schema({
      search: { type: "string" },
      documentType: DOCUMENT_TYPE,
      applicationId: ID,
      componentId: ID,
      collectionId: ID,
      status: { type: "string", enum: ALL_STATUSES },
      currentOnly: { type: "boolean" },
      includeWorkspace: { type: "boolean" },
      includeArchived: { type: "boolean" },
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
  ),
  definition(
    "documents_get",
    "Obtém um documento com Markdown, metadados específicos e relações.",
    getDocument,
    schema({ documentId: ID }, ["documentId"]),
  ),
  definition(
    "documents_create",
    "Cria um documento usando o contrato discriminado pelo documentType. O workspace vem da configuração do MCP; applicationId e details seguem as regras de cada tipo.",
    createDocument,
    schema(COMMON, ["documentType", "title", "summary", "markdown"], {
      oneOf: CREATE_VARIANTS,
    }),
  ),
  definition(
    "documents_update",
    "Atualiza um documento existente. documentType é imutável; consulte documents_get antes de alterar contexto, status ou details.",
    updateDocument,
    schema({ documentId: ID, ...COMMON }, ["documentId"]),
  ),
  definition(
    "documents_add_observation",
    "Acrescenta uma observação imutável a um documento.",
    addDocumentObservation,
    schema({ documentId: ID, markdown: ID }, ["documentId", "markdown"]),
  ),
];
