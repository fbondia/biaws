import { bindTool } from "../../mcp/tools/bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../mcp/tools/contracts.js";
import { secretTools as definitions } from "./schemas.js";
import { listSecretMetadata, registerSecretMetadata } from "./service.js";
const handlers: Record<string, ToolHandler> = {
  secrets_list: bindTool("secrets_list", listSecretMetadata),

  secrets_register: bindTool("secrets_register", registerSecretMetadata),
};
export const secretTools: (ToolDefinition & { handler: ToolHandler })[] = definitions.map((tool) => ({
  ...tool,
  handler: handlers[tool.name],
}));
