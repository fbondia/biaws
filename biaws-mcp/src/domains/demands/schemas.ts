import type { ToolDefinition } from "../../mcp/tools/contracts.js";
export const demandTools = [
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
] as const satisfies readonly ToolDefinition[];
