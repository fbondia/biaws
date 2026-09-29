import { bindTool } from "../../bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../contracts.js";
import { secretTools as definitions } from "./schemas.js";
import {
  getSecretMetadata,
  listSecretMetadata,
  registerSecretMetadata,
} from "./service.js";
const handlers: Record<string, ToolHandler> = {
  secrets_list: bindTool("secrets_list", listSecretMetadata),
  secrets_get: bindTool("secrets_get", getSecretMetadata),
  secrets_register: bindTool("secrets_register", registerSecretMetadata),
};
export const secretTools: (ToolDefinition & { handler: ToolHandler })[] =
  definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
