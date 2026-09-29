import type { ToolDefinition } from "../../contracts.js";
export const attachmentTools = [
  {
    name: "attachments_upload",
    description:
      "Envia de um a dez arquivos em Base64 para um chamado, melhoria, tarefa ou documento.",
    inputSchema: {
      type: "object",
      required: ["entityType", "entityId", "files"],
      additionalProperties: false,
      properties: {
        entityType: {
          type: "string",
          enum: ["issue", "demand", "task", "document"],
          description: "Tipo do registro ao qual o arquivo pertence.",
        },
        entityId: {
          type: "string",
          minLength: 1,
          description:
            "ID do chamado, melhoria ou documento. Para task, informe o ID da melhoria pai.",
        },
        taskId: {
          type: "string",
          minLength: 1,
          description:
            "ID ou código da tarefa; obrigatório somente quando entityType é task.",
        },
        workspaceId: {
          type: "string",
          description: "ID público do workspace.",
        },
        applicationId: {
          type: "string",
          description: "ID público da aplicação.",
        },
        componentId: {
          type: "string",
          description: "ID de componente afetado.",
        },
        files: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          items: {
            type: "object",
            required: ["filename", "contentBase64"],
            additionalProperties: false,
            properties: {
              filename: {
                type: "string",
                minLength: 1,
              },
              contentType: {
                type: "string",
                description:
                  "MIME type; usa application/octet-stream quando omitido.",
              },
              contentBase64: {
                type: "string",
                minLength: 1,
                description:
                  "Conteúdo integral do arquivo codificado em Base64.",
              },
            },
          },
        },
        tags: {
          type: "array",
          maxItems: 20,
          uniqueItems: true,
          items: {
            type: "string",
            minLength: 1,
            maxLength: 40,
          },
          description:
            "Tags do arquivo. Em tarefas, o código da tarefa é preservado automaticamente.",
        },
      },
    },
  },
  {
    name: "attachments_download",
    description:
      "Baixa um anexo e devolve seus metadados e conteúdo integral em Base64.",
    inputSchema: {
      type: "object",
      required: ["entityType", "entityId", "attachmentId"],
      additionalProperties: false,
      properties: {
        entityType: {
          type: "string",
          enum: ["issue", "demand", "task", "document"],
          description: "Tipo do registro ao qual o arquivo pertence.",
        },
        entityId: {
          type: "string",
          minLength: 1,
          description:
            "ID do chamado, melhoria ou documento. Para task, informe o ID da melhoria pai.",
        },
        taskId: {
          type: "string",
          minLength: 1,
          description:
            "ID ou código da tarefa; obrigatório somente quando entityType é task.",
        },
        workspaceId: {
          type: "string",
          description: "ID público do workspace.",
        },
        applicationId: {
          type: "string",
          description: "ID público da aplicação.",
        },
        componentId: {
          type: "string",
          description: "ID de componente afetado.",
        },
        attachmentId: {
          type: ["string", "integer"],
          description: "ID do anexo ou índice numérico de um anexo legado.",
        },
      },
    },
  },
  {
    name: "attachments_update_tags",
    description:
      "Substitui as tags de um anexo. Em tarefas, mantém a tag de associação com a tarefa.",
    inputSchema: {
      type: "object",
      required: ["entityType", "entityId", "attachmentId", "tags"],
      additionalProperties: false,
      properties: {
        entityType: {
          type: "string",
          enum: ["issue", "demand", "task", "document"],
          description: "Tipo do registro ao qual o arquivo pertence.",
        },
        entityId: {
          type: "string",
          minLength: 1,
          description:
            "ID do chamado, melhoria ou documento. Para task, informe o ID da melhoria pai.",
        },
        taskId: {
          type: "string",
          minLength: 1,
          description:
            "ID ou código da tarefa; obrigatório somente quando entityType é task.",
        },
        workspaceId: {
          type: "string",
          description: "ID público do workspace.",
        },
        applicationId: {
          type: "string",
          description: "ID público da aplicação.",
        },
        componentId: {
          type: "string",
          description: "ID de componente afetado.",
        },
        attachmentId: {
          type: ["string", "integer"],
          description: "ID do anexo ou índice numérico de um anexo legado.",
        },
        tags: {
          type: "array",
          maxItems: 20,
          uniqueItems: true,
          items: {
            type: "string",
            minLength: 1,
            maxLength: 40,
          },
          description:
            "Tags do arquivo. Em tarefas, o código da tarefa é preservado automaticamente.",
        },
      },
    },
  },
  {
    name: "attachments_delete",
    description: "Exclui permanentemente um anexo e seu conteúdo armazenado.",
    inputSchema: {
      type: "object",
      required: ["entityType", "entityId", "attachmentId"],
      additionalProperties: false,
      properties: {
        entityType: {
          type: "string",
          enum: ["issue", "demand", "task", "document"],
          description: "Tipo do registro ao qual o arquivo pertence.",
        },
        entityId: {
          type: "string",
          minLength: 1,
          description:
            "ID do chamado, melhoria ou documento. Para task, informe o ID da melhoria pai.",
        },
        taskId: {
          type: "string",
          minLength: 1,
          description:
            "ID ou código da tarefa; obrigatório somente quando entityType é task.",
        },
        workspaceId: {
          type: "string",
          description: "ID público do workspace.",
        },
        applicationId: {
          type: "string",
          description: "ID público da aplicação.",
        },
        componentId: {
          type: "string",
          description: "ID de componente afetado.",
        },
        attachmentId: {
          type: ["string", "integer"],
          description: "ID do anexo ou índice numérico de um anexo legado.",
        },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];
