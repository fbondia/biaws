import { bindTool } from "./bindTool.js";
import type { ToolDefinition, ToolHandler } from "./contracts.js";
import { attachmentTools } from "./domains/attachments/tools.js";
import { auditTools } from "./domains/audit/tools.js";
import { catalogTools } from "./domains/catalog/tools.js";
import { collectionTools } from "./domains/collections/tools.js";
import {
  addDemandNote,
  addDemandTaskNote,
  createDemand,
  createDemandTask,
  deleteDemandTask,
  deleteDemandTaskNote,
  getDemand,
  getDemandDeadlines,
  getDemandImplementationContext,
  getJourneyCalendar,
  listDemands,
  listDemandTasks,
  updateDemandDescription,
  updateDemandTask,
  updateDemandTaskNote,
  updateDemandTaskStatus,
} from "./domains/demands/service.js";
import { demandMutationTools } from "./domains/demands/tools.js";
import {
  addIssueComment,
  classifyIssue,
  createIssue,
  createTaxonomyItem,
  findIssuesByTaxonomy,
  getIssueClassificationCatalog,
  getIssueDetails,
  importEml,
  searchIssues,
  suggestTaxonomy,
  summarizeIssuesForSupport,
  updateIssue,
  updateIssueComment,
  updateIssueState,
  updateTaxonomyItem,
} from "./domains/issues/service.js";
import { knowledgeTools } from "./domains/knowledge/tools.js";
import { monitoringTools } from "./domains/monitoring/tools.js";
import { secretTools } from "./domains/secrets/tools.js";
import { BiawsError } from "./errors.js";
import { toolDefinitions } from "./toolCatalog.js";
import type { ToolResultMap } from "./toolResults.js";
const handlers: Record<string, ToolHandler> = {
  issues_search: bindTool("issues_search", searchIssues),
  issues_get: bindTool("issues_get", getIssueDetails),
  issues_update: bindTool("issues_update", updateIssue),
  issues_add_comment: bindTool("issues_add_comment", addIssueComment),
  issues_update_comment: bindTool("issues_update_comment", updateIssueComment),
  issues_get_classification_catalog: bindTool(
    "issues_get_classification_catalog",
    getIssueClassificationCatalog,
  ),
  issues_create_taxonomy_item: bindTool(
    "issues_create_taxonomy_item",
    createTaxonomyItem,
  ),
  issues_update_taxonomy_item: bindTool(
    "issues_update_taxonomy_item",
    updateTaxonomyItem,
  ),
  issues_summary: bindTool("issues_summary", summarizeIssuesForSupport),
  issues_aggregate: bindTool("issues_aggregate", summarizeIssuesForSupport),
  issues_create: bindTool("issues_create", createIssue),
  issues_import_eml: bindTool("issues_import_eml", importEml),
  issues_update_state: bindTool("issues_update_state", updateIssueState),
  issues_suggest_taxonomy: bindTool("issues_suggest_taxonomy", suggestTaxonomy),
  issues_classify: bindTool("issues_classify", classifyIssue),
  issues_by_taxonomy: bindTool("issues_by_taxonomy", findIssuesByTaxonomy),
  demands_list: bindTool("demands_list", listDemands),
  demands_get: bindTool("demands_get", getDemand),
  demands_create: bindTool("demands_create", createDemand),
  demands_journey_calendar: bindTool(
    "demands_journey_calendar",
    getJourneyCalendar,
  ),
  demands_deadlines: bindTool("demands_deadlines", getDemandDeadlines),
  demands_implementation_context: bindTool(
    "demands_implementation_context",
    getDemandImplementationContext,
  ),
  demands_add_note: bindTool("demands_add_note", addDemandNote),
  demands_update_description: bindTool(
    "demands_update_description",
    updateDemandDescription,
  ),
  demands_list_tasks: bindTool("demands_list_tasks", listDemandTasks),
  demands_create_task: bindTool("demands_create_task", createDemandTask),
  demands_update_task: bindTool("demands_update_task", updateDemandTask),
  demands_update_task_status: bindTool(
    "demands_update_task_status",
    updateDemandTaskStatus,
  ),
  demands_delete_task: bindTool("demands_delete_task", deleteDemandTask),
  demands_add_task_note: bindTool("demands_add_task_note", addDemandTaskNote),
  demands_update_task_note: bindTool(
    "demands_update_task_note",
    updateDemandTaskNote,
  ),
  demands_delete_task_note: bindTool(
    "demands_delete_task_note",
    deleteDemandTaskNote,
  ),
};
const domainTools = [
  catalogTools,
  collectionTools,
  secretTools,
  knowledgeTools,
  attachmentTools,
  demandMutationTools,
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
