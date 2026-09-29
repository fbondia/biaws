import type { ToolDefinition } from "../../contracts.js";
export const collectionTools = [
  {
    name: "resource_collections_create",
    description:
      "Cria uma coleção na raiz ou sob uma coleção pai do mesmo tipo e workspace.",
    inputSchema: {
      type: "object",
      required: ["resourceType", "name"],
      additionalProperties: false,
      properties: {
        resourceType: {
          type: "string",
          enum: [
            "applications",
            "demands",
            "documents",
            "secrets",
            "skills",
            "servers",
          ],
        },
        name: {
          type: "string",
          minLength: 1,
        },
        parentId: {
          type: "string",
          description:
            "ID da coleção de destino; vazio move o item para a raiz.",
        },
      },
    },
  },
  {
    name: "resource_collections_update",
    description:
      "Renomeia ou reparenta uma coleção, impedindo ciclos na árvore.",
    inputSchema: {
      type: "object",
      required: ["resourceType", "collectionId"],
      additionalProperties: false,
      properties: {
        resourceType: {
          type: "string",
          enum: [
            "applications",
            "demands",
            "documents",
            "secrets",
            "skills",
            "servers",
          ],
        },
        collectionId: {
          type: "string",
          minLength: 1,
        },
        name: {
          type: "string",
          minLength: 1,
        },
        parentId: {
          type: "string",
          description:
            "ID da coleção de destino; vazio move o item para a raiz.",
        },
      },
    },
  },
  {
    name: "resource_collections_delete",
    description:
      "Exclui somente uma coleção vazia, sem subcoleções nem recursos vinculados.",
    inputSchema: {
      type: "object",
      required: ["resourceType", "collectionId"],
      additionalProperties: false,
      properties: {
        resourceType: {
          type: "string",
          enum: [
            "applications",
            "demands",
            "documents",
            "secrets",
            "skills",
            "servers",
          ],
        },
        collectionId: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
  {
    name: "applications_move_to_collection",
    description:
      "Move applications para uma coleção validada do workspace; collectionId vazio move para a raiz.",
    inputSchema: {
      type: "object",
      required: ["applicationId", "collectionId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        collectionId: {
          type: "string",
          description:
            "ID da coleção de destino; vazio move o item para a raiz.",
        },
      },
    },
  },
  {
    name: "servers_move_to_collection",
    description:
      "Move servers para uma coleção validada do workspace; collectionId vazio move para a raiz.",
    inputSchema: {
      type: "object",
      required: ["serverId", "collectionId"],
      additionalProperties: false,
      properties: {
        serverId: {
          type: "string",
          minLength: 1,
        },
        collectionId: {
          type: "string",
          description:
            "ID da coleção de destino; vazio move o item para a raiz.",
        },
      },
    },
  },
  {
    name: "secrets_move_to_collection",
    description:
      "Move secrets para uma coleção validada do workspace; collectionId vazio move para a raiz.",
    inputSchema: {
      type: "object",
      required: ["secretId", "collectionId"],
      additionalProperties: false,
      properties: {
        secretId: {
          type: "string",
          minLength: 1,
        },
        collectionId: {
          type: "string",
          description:
            "ID da coleção de destino; vazio move o item para a raiz.",
        },
      },
    },
  },
  {
    name: "skills_move_to_collection",
    description:
      "Move skills para uma coleção validada do workspace; collectionId vazio move para a raiz.",
    inputSchema: {
      type: "object",
      required: ["skillId", "collectionId"],
      additionalProperties: false,
      properties: {
        skillId: {
          type: "string",
          minLength: 1,
        },
        collectionId: {
          type: "string",
          description:
            "ID da coleção de destino; vazio move o item para a raiz.",
        },
      },
    },
  },
  {
    name: "demands_move_to_collection",
    description:
      "Move demands para uma coleção validada do workspace; collectionId vazio move para a raiz.",
    inputSchema: {
      type: "object",
      required: ["requestId", "collectionId"],
      additionalProperties: false,
      properties: {
        requestId: {
          type: "string",
          minLength: 1,
        },
        collectionId: {
          type: "string",
          description:
            "ID da coleção de destino; vazio move o item para a raiz.",
        },
      },
    },
  },
  {
    name: "documents_move_to_collection",
    description:
      "Move documents para uma coleção validada do workspace; collectionId vazio move para a raiz.",
    inputSchema: {
      type: "object",
      required: ["documentId", "collectionId"],
      additionalProperties: false,
      properties: {
        documentId: {
          type: "string",
          minLength: 1,
        },
        collectionId: {
          type: "string",
          description:
            "ID da coleção de destino; vazio move o item para a raiz.",
        },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];
