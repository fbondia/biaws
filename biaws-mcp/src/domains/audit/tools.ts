import { bindTool } from "../../bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../contracts.js";
import { auditTools as definitions } from "./schemas.js";
import { listAuditEvents } from "./service.js";
const handlers: Record<string, ToolHandler> = {
  audit_events_list: bindTool("audit_events_list", listAuditEvents),
};
export const auditTools: (ToolDefinition & { handler: ToolHandler })[] =
  definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
