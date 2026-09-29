import { bindTool } from "../../bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../contracts.js";
import { collectionTools as definitions } from "./schemas.js";
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
const handlers: Record<string, ToolHandler> = {
  resource_collections_list: bindTool(
    "resource_collections_list",
    listResourceCollections,
  ),
  resource_collections_create: bindTool(
    "resource_collections_create",
    createResourceCollection,
  ),
  resource_collections_update: bindTool(
    "resource_collections_update",
    updateResourceCollection,
  ),
  resource_collections_delete: bindTool(
    "resource_collections_delete",
    deleteResourceCollection,
  ),
  applications_move_to_collection: bindTool(
    "applications_move_to_collection",
    moveApplicationToCollection,
  ),
  servers_move_to_collection: bindTool(
    "servers_move_to_collection",
    moveServerToCollection,
  ),
  secrets_move_to_collection: bindTool(
    "secrets_move_to_collection",
    moveSecretToCollection,
  ),
  skills_move_to_collection: bindTool(
    "skills_move_to_collection",
    moveSkillToCollection,
  ),
  demands_move_to_collection: bindTool(
    "demands_move_to_collection",
    moveDemandToCollection,
  ),
  documents_move_to_collection: bindTool(
    "documents_move_to_collection",
    moveDocumentToCollection,
  ),
};
export const collectionTools: (ToolDefinition & { handler: ToolHandler })[] =
  definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
