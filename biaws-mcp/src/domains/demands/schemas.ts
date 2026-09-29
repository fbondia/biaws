import type { ToolDefinition } from "../../contracts.js";
export const demandMutationTools = [
  {
    name: "demands_update",
    description:
      "Atualiza dados cadastrais, status, prazos e contexto de uma melhoria. Informe pelo menos um campo; campos omitidos são preservados.",
    inputSchema: {
      type: "object",
      required: ["requestId"],
      additionalProperties: false,
      properties: {
        requestId: {
          type: "string",
          minLength: 1,
          description: "ID ou código exato da melhoria.",
        },
        clientCode: {
          type: "string",
        },
        title: {
          type: "string",
          minLength: 1,
        },
        description: {
          type: "string",
        },
        status: {
          type: "string",
          minLength: 1,
          description:
            "Status vigente em Configurações/Listas de Opções; validado pela API.",
        },
        estimatedDeliveryDate: {
          type: "string",
          description: "YYYY-MM-DD ou vazio.",
        },
        startDate: {
          type: "string",
          description: "YYYY-MM-DD ou vazio.",
        },
        endDate: {
          type: "string",
          description: "YYYY-MM-DD ou vazio.",
        },
        estimatedJourneys: {
          type: "number",
          minimum: 0,
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
          description:
            "Substitui os componentes afetados; [] remove as associações.",
        },
      },
    },
  },
  {
    name: "demands_update_specification",
    description:
      "Substitui todas as seções da especificação de uma melhoria, preservando os demais dados. Consulte demands_get antes de editar; [] remove todas as seções.",
    inputSchema: {
      type: "object",
      required: ["requestId", "specificationSections"],
      additionalProperties: false,
      properties: {
        requestId: {
          type: "string",
          minLength: 1,
          description: "ID ou código exato da melhoria.",
        },
        specificationSections: {
          type: "array",
          maxItems: 500,
          items: {
            type: "object",
            required: ["id", "title", "content", "order"],
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
                minLength: 1,
              },
              title: {
                type: "string",
                minLength: 1,
              },
              content: {
                type: "string",
                description: "Conteúdo em Markdown.",
              },
              order: {
                type: "integer",
                minimum: 0,
              },
            },
          },
        },
      },
    },
  },
  {
    name: "demands_update_checklist",
    description:
      "Substitui todos os itens do checklist de uma melhoria, incluindo conclusão, data e comentário. Consulte demands_get antes de editar; [] limpa o checklist.",
    inputSchema: {
      type: "object",
      required: ["requestId", "checklist"],
      additionalProperties: false,
      properties: {
        requestId: {
          type: "string",
          minLength: 1,
          description: "ID ou código exato da melhoria.",
        },
        checklist: {
          type: "array",
          maxItems: 1000,
          items: {
            type: "object",
            required: ["label", "done"],
            additionalProperties: false,
            properties: {
              label: {
                type: "string",
                minLength: 1,
              },
              done: {
                type: "boolean",
              },
              date: {
                type: "string",
                description: "YYYY-MM-DD ou vazio.",
              },
              comment: {
                type: "string",
              },
            },
          },
        },
      },
    },
  },
  {
    name: "demands_update_journeys",
    description:
      "Substitui o planejamento mensal de jornadas da melhoria. Consulte demands_get antes de editar; a API normaliza os meses segundo o período da melhoria.",
    inputSchema: {
      type: "object",
      required: ["requestId", "journeys"],
      additionalProperties: false,
      properties: {
        requestId: {
          type: "string",
          minLength: 1,
          description: "ID ou código exato da melhoria.",
        },
        journeys: {
          type: "array",
          maxItems: 240,
          items: {
            type: "object",
            required: ["month", "plannedJourneys"],
            additionalProperties: false,
            properties: {
              month: {
                type: "string",
                pattern: "^\\d{4}-(0[1-9]|1[0-2])$",
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
      },
    },
  },
  {
    name: "demands_update_note",
    description:
      "Atualiza o conteúdo de uma nota da melhoria e, opcionalmente, sua data. A data existente é preservada quando omitida.",
    inputSchema: {
      type: "object",
      required: ["requestId", "noteId", "content"],
      additionalProperties: false,
      properties: {
        requestId: {
          type: "string",
          minLength: 1,
          description: "ID ou código exato da melhoria.",
        },
        noteId: {
          type: "string",
          minLength: 1,
        },
        content: {
          type: "string",
          minLength: 1,
        },
        date: {
          type: "string",
          description: "YYYY-MM-DD ou vazio.",
        },
      },
    },
  },
  {
    name: "demands_delete_note",
    description:
      "Exclui permanentemente uma nota da melhoria identificada por noteId.",
    inputSchema: {
      type: "object",
      required: ["requestId", "noteId"],
      additionalProperties: false,
      properties: {
        requestId: {
          type: "string",
          minLength: 1,
          description: "ID ou código exato da melhoria.",
        },
        noteId: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];
