import {
  addKnowledgeObservation,
  createKnowledgeRecord,
  getKnowledgeRecord,
  loadKnowledgeContext,
  searchKnowledgeRecords,
  updateKnowledgeRecord,
} from "./service.js";

const ID = { type: "string", minLength: 1 };
const REFERENCES = {
  type: "array",
  maxItems: 100,
  items: {
    type: "object",
    required: ["targetType", "targetId"],
    additionalProperties: false,
    properties: {
      targetType: {
        type: "string",
        enum: ["business-rules", "architecture-decisions"],
      },
      targetId: ID,
      relationship: { type: "string" },
    },
  },
};
const COMMON = {
  title: ID,
  markdown: ID,
  applicationId: ID,
  affectedComponentIds: {
    type: "array",
    maxItems: 100,
    items: ID,
  },
  collectionId: { type: "string" },
  status: { type: "string" },
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

function toolsFor(prefix, type, label) {
  return [
    definition(
      `${prefix}_search`,
      `Busca ${label} por aplicação, componente, coleção, estado ou texto.`,
      (args) => searchKnowledgeRecords(type, args),
      schema({
        search: { type: "string" },
        applicationId: ID,
        componentId: ID,
        collectionId: ID,
        status: { type: "string" },
        includeArchived: { type: "boolean" },
        page: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      }),
    ),
    definition(
      `${prefix}_get`,
      `Obtém uma ${label.slice(0, -1)} com Markdown e relações.`,
      (args) => getKnowledgeRecord(type, args),
      schema({ recordId: ID }, ["recordId"]),
    ),
    definition(
      `${prefix}_create`,
      `Cria uma ${label.slice(0, -1)} relacionada a uma aplicação.`,
      (args) => createKnowledgeRecord(type, args),
      schema(COMMON, ["title", "markdown", "applicationId"]),
    ),
    definition(
      `${prefix}_update`,
      `Atualiza conteúdo, contexto, revisão e relações de uma ${label.slice(0, -1)}.`,
      (args) => updateKnowledgeRecord(type, args),
      schema({ recordId: ID, ...COMMON }, ["recordId"]),
    ),
    definition(
      `${prefix}_add_observation`,
      `Acrescenta uma observação imutável a uma ${label.slice(0, -1)}.`,
      (args) => addKnowledgeObservation(type, args),
      schema({ recordId: ID, markdown: ID }, ["recordId", "markdown"]),
    ),
  ];
}

export const knowledgeTools = [
  definition(
    "knowledge_context_load",
    "Carrega regras ativas e decisões aceitas aplicáveis a uma aplicação ou componente, com Markdown opcional.",
    loadKnowledgeContext,
    schema(
      {
        applicationId: ID,
        componentId: ID,
        includeMarkdown: { type: "boolean", default: true },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 25 },
      },
      ["applicationId"],
    ),
  ),
  ...toolsFor("business_rules", "business-rules", "regras de negócio"),
  ...toolsFor(
    "architecture_decisions",
    "architecture-decisions",
    "decisões arquiteturais",
  ),
];
