import {
  addDocumentObservation,
  createDocument,
  getDocument,
  loadKnowledgeContext,
  searchDocuments,
  updateDocument,
} from "./service.js";

const ID = { type: "string", minLength: 1 };
const DOCUMENT_TYPE = {
  type: "string",
  enum: [
    "business-rule",
    "architecture-decision",
    "guideline",
    "feature",
    "technical-reference",
    "procedure",
  ],
};
const REFERENCES = {
  type: "array",
  maxItems: 100,
  items: {
    type: "object",
    required: ["targetDocumentId"],
    additionalProperties: false,
    properties: {
      targetDocumentId: ID,
      relationship: { type: "string" },
    },
  },
};
const COMMON = {
  documentType: DOCUMENT_TYPE,
  title: ID,
  summary: { type: "string", minLength: 1, maxLength: 500 },
  markdown: ID,
  applicationId: { type: "string" },
  affectedComponentIds: { type: "array", maxItems: 100, items: ID },
  collectionId: { type: "string" },
  status: { type: "string" },
  details: { type: "object" },
  classification: {
    type: "object",
    properties: {
      primaryTaxonomyId: { type: "string" },
      secondaryTaxonomyIds: { type: "array", items: ID },
      tags: {
        type: "object",
        additionalProperties: { type: "array", items: ID },
      },
    },
  },
  source: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["native", "repository"] },
      repositoryId: { type: "string" },
      path: { type: "string" },
    },
  },
  references: REFERENCES,
  definedAt: { type: "string", description: "YYYY-MM-DD" },
  lastReviewedAt: { type: "string", description: "YYYY-MM-DD ou vazio" },
  nextReviewAt: { type: "string", description: "YYYY-MM-DD ou vazio" },
  changeSummary: { type: "string" },
};

function schema(properties, required = []) {
  return {
    type: "object",
    ...(required.length ? { required } : {}),
    additionalProperties: false,
    properties,
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
    "documents_search",
    "Busca documentos por tipo, aplicação, componente, coleção, estado ou texto.",
    searchDocuments,
    schema({
      search: { type: "string" },
      documentType: DOCUMENT_TYPE,
      applicationId: ID,
      componentId: ID,
      collectionId: ID,
      status: { type: "string" },
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
    "Cria um documento tipado no workspace ou em uma aplicação.",
    createDocument,
    schema(COMMON, ["documentType", "title", "summary", "markdown"]),
  ),
  definition(
    "documents_update",
    "Atualiza conteúdo, contexto, metadados e relações de um documento.",
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
