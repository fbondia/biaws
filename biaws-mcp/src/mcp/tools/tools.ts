import type { ToolDefinition, ToolHandler } from "./contracts.js";
import { attachmentTools } from "../../domains/attachments/tools.js";
import { auditTools } from "../../domains/audit/tools.js";
import { catalogTools } from "../../domains/catalog/tools.js";
import { collectionTools } from "../../domains/collections/tools.js";
import { demandTools } from "../../domains/demands/tools.js";
import { issueTools } from "../../domains/issues/tools.js";
import { knowledgeTools } from "../../domains/knowledge/tools.js";
import { monitoringTools } from "../../domains/monitoring/tools.js";
import { secretTools } from "../../domains/secrets/tools.js";
import { BiawsError } from "../../runtime/errors.js";
import { toolDefinitions } from "./toolCatalog.js";
import type { ToolResultMap } from "./toolResults.js";
const handlers: Record<string, ToolHandler> = {};
const domainTools = [
  catalogTools,
  collectionTools,
  secretTools,
  knowledgeTools,
  attachmentTools,
  demandTools,
  issueTools,
  auditTools,
  monitoringTools,
].flat();
for (const tool of domainTools) handlers[tool.name] = tool.handler;
const tools = toolDefinitions.map((tool) => ({
  ...tool,
  handler: handlers[tool.name],
}));

const toolByName = new Map<string, (typeof tools)[number]>(
  tools.map((tool) => [tool.name, tool]),
);

export function listTools(): ToolDefinition[] {
  return tools.map(({ handler, ...tool }) => tool);
}

export function dispatchTool<N extends keyof ToolResultMap>(
  name: N,
  args: unknown,
): Promise<ToolResultMap[N]>;
export function dispatchTool(name: string, args: unknown): Promise<unknown>;
export async function dispatchTool(name: string, args: unknown) {
  const tool = toolByName.get(name);
  if (!tool) {
    const error = new BiawsError(`Unknown tool: ${name}`);
    error.code = "TOOL_NOT_FOUND";
    error.statusCode = 404;
    error.retryable = false;
    throw error;
  }
  return tool.handler(args);
}
