import {
  createResourceCollection,
  deleteResourceCollection,
  listResourceCollections,
  moveApplicationToCollection,
  moveDemandToCollection,
  moveDocumentToCollection,
  moveSecretToCollection,
  moveServerToCollection,
  moveSkillToCollection,
  updateResourceCollection,
} from "./service.js";

const ID = { type: "string", minLength: 1 };
const COLLECTION_ID = {
  type: "string",
  description: "ID da coleção de destino; vazio move o item para a raiz.",
};
const RESOURCE_TYPE = {
  type: "string",
  enum: [
    "applications",
    "demands",
    "documents",
    "secrets",
    "skills",
    "servers",
  ],
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

function moveDefinition(resource, idField, handler) {
  return definition(
    `${resource}_move_to_collection`,
    `Move ${resource} para uma coleção validada do workspace; collectionId vazio move para a raiz.`,
    handler,
    schema({ [idField]: ID, collectionId: COLLECTION_ID }, [
      idField,
      "collectionId",
    ]),
  );
}

export const collectionTools = [
  definition(
    "resource_collections_list",
    "Lista a árvore de coleções do tipo de recurso informado no workspace autenticado.",
    listResourceCollections,
    schema({ resourceType: RESOURCE_TYPE }, ["resourceType"]),
  ),
  definition(
    "resource_collections_create",
    "Cria uma coleção na raiz ou sob uma coleção pai do mesmo tipo e workspace.",
    createResourceCollection,
    schema({ resourceType: RESOURCE_TYPE, name: ID, parentId: COLLECTION_ID }, [
      "resourceType",
      "name",
    ]),
  ),
  definition(
    "resource_collections_update",
    "Renomeia ou reparenta uma coleção, impedindo ciclos na árvore.",
    updateResourceCollection,
    schema(
      {
        resourceType: RESOURCE_TYPE,
        collectionId: ID,
        name: ID,
        parentId: COLLECTION_ID,
      },
      ["resourceType", "collectionId"],
    ),
  ),
  definition(
    "resource_collections_delete",
    "Exclui somente uma coleção vazia, sem subcoleções nem recursos vinculados.",
    deleteResourceCollection,
    schema({ resourceType: RESOURCE_TYPE, collectionId: ID }, [
      "resourceType",
      "collectionId",
    ]),
  ),
  moveDefinition("applications", "applicationId", moveApplicationToCollection),
  moveDefinition("servers", "serverId", moveServerToCollection),
  moveDefinition("secrets", "secretId", moveSecretToCollection),
  moveDefinition("skills", "skillId", moveSkillToCollection),
  moveDefinition("demands", "requestId", moveDemandToCollection),
  moveDefinition("documents", "documentId", moveDocumentToCollection),
];
