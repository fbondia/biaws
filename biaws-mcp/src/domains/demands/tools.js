import {
  deleteDemandNote,
  updateDemand,
  updateDemandChecklist,
  updateDemandJourneys,
  updateDemandNote,
  updateDemandSpecification,
} from "./service.js";

const requestId = {
  type: "string",
  minLength: 1,
  description: "ID ou código exato da melhoria.",
};
const date = { type: "string", description: "YYYY-MM-DD ou vazio." };
const text = { type: "string", minLength: 1 };

function tool(name, description, properties, required, handler) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      required: ["requestId", ...required],
      additionalProperties: false,
      properties: { requestId, ...properties },
    },
    handler,
  };
}

export const demandMutationTools = [
  tool(
    "demands_update",
    "Atualiza dados cadastrais, status, prazos e contexto de uma melhoria. Informe pelo menos um campo; campos omitidos são preservados.",
    {
      clientCode: { type: "string" },
      title: text,
      description: { type: "string" },
      status: {
        ...text,
        description:
          "Status vigente em Configurações/Listas de Opções; validado pela API.",
      },
      estimatedDeliveryDate: date,
      startDate: date,
      endDate: date,
      estimatedJourneys: { type: "number", minimum: 0 },
      applicationId: text,
      affectedComponentIds: {
        type: "array",
        maxItems: 100,
        uniqueItems: true,
        items: text,
        description:
          "Substitui os componentes afetados; [] remove as associações.",
      },
    },
    [],
    updateDemand,
  ),
  tool(
    "demands_update_specification",
    "Substitui todas as seções da especificação de uma melhoria, preservando os demais dados. Consulte demands_get antes de editar; [] remove todas as seções.",
    {
      specificationSections: {
        type: "array",
        maxItems: 500,
        items: {
          type: "object",
          required: ["id", "title", "content", "order"],
          additionalProperties: false,
          properties: {
            id: text,
            title: text,
            content: { type: "string", description: "Conteúdo em Markdown." },
            order: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    ["specificationSections"],
    updateDemandSpecification,
  ),
  tool(
    "demands_update_checklist",
    "Substitui todos os itens do checklist de uma melhoria, incluindo conclusão, data e comentário. Consulte demands_get antes de editar; [] limpa o checklist.",
    {
      checklist: {
        type: "array",
        maxItems: 1000,
        items: {
          type: "object",
          required: ["label", "done"],
          additionalProperties: false,
          properties: {
            label: text,
            done: { type: "boolean" },
            date,
            comment: { type: "string" },
          },
        },
      },
    },
    ["checklist"],
    updateDemandChecklist,
  ),
  tool(
    "demands_update_journeys",
    "Substitui o planejamento mensal de jornadas da melhoria. Consulte demands_get antes de editar; a API normaliza os meses segundo o período da melhoria.",
    {
      journeys: {
        type: "array",
        maxItems: 240,
        items: {
          type: "object",
          required: ["month", "plannedJourneys"],
          additionalProperties: false,
          properties: {
            month: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
            plannedJourneys: { type: "number", minimum: 0 },
            executedJourneys: { type: "number", minimum: 0, default: 0 },
            comment: { type: "string" },
          },
        },
      },
    },
    ["journeys"],
    updateDemandJourneys,
  ),
  tool(
    "demands_update_note",
    "Atualiza o conteúdo de uma nota da melhoria e, opcionalmente, sua data. A data existente é preservada quando omitida.",
    { noteId: text, content: text, date },
    ["noteId", "content"],
    updateDemandNote,
  ),
  tool(
    "demands_delete_note",
    "Exclui permanentemente uma nota da melhoria identificada por noteId.",
    { noteId: text },
    ["noteId"],
    deleteDemandNote,
  ),
];
