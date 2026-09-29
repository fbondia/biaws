import { bindTool } from "../../bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../contracts.js";
import { knowledgeTools as definitions } from "./schemas.js";
import {
  addDocumentObservation,
  createDocument,
  getDocument,
  listDocumentObservations,
  listDocumentRevisions,
  listDocumentTypes,
  loadKnowledgeContext,
  searchDocuments,
  updateDocument,
} from "./service.js";
const handlers: Record<string, ToolHandler> = {
  knowledge_context_load: bindTool(
    "knowledge_context_load",
    loadKnowledgeContext,
  ),
  document_types_list: bindTool("document_types_list", listDocumentTypes),
  documents_search: bindTool("documents_search", searchDocuments),
  documents_get: bindTool("documents_get", getDocument),
  documents_list_revisions: bindTool(
    "documents_list_revisions",
    listDocumentRevisions,
  ),
  documents_list_observations: bindTool(
    "documents_list_observations",
    listDocumentObservations,
  ),
  documents_create: bindTool("documents_create", createDocument),
  documents_update: bindTool("documents_update", updateDocument),
  documents_add_observation: bindTool(
    "documents_add_observation",
    addDocumentObservation,
  ),
};
export const knowledgeTools: (ToolDefinition & { handler: ToolHandler })[] =
  definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
