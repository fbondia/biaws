import { bindTool } from "../../mcp/tools/bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../mcp/tools/contracts.js";
import { issueTools as definitions } from "./schemas.js";
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
} from "./service.js";
const handlers: Record<string, ToolHandler> = {
  issues_search: bindTool("issues_search", searchIssues),
  issues_get: bindTool("issues_get", getIssueDetails),
  issues_update: bindTool("issues_update", updateIssue),
  issues_add_comment: bindTool("issues_add_comment", addIssueComment),
  issues_update_comment: bindTool("issues_update_comment", updateIssueComment),
  issues_get_classification_catalog: bindTool("issues_get_classification_catalog", getIssueClassificationCatalog),
  issues_create_taxonomy_item: bindTool("issues_create_taxonomy_item", createTaxonomyItem),
  issues_update_taxonomy_item: bindTool("issues_update_taxonomy_item", updateTaxonomyItem),
  issues_summary: bindTool("issues_summary", summarizeIssuesForSupport),
  issues_aggregate: bindTool("issues_aggregate", summarizeIssuesForSupport),
  issues_create: bindTool("issues_create", createIssue),
  issues_import_eml: bindTool("issues_import_eml", importEml),
  issues_update_state: bindTool("issues_update_state", updateIssueState),
  issues_suggest_taxonomy: bindTool("issues_suggest_taxonomy", suggestTaxonomy),
  issues_classify: bindTool("issues_classify", classifyIssue),
  issues_by_taxonomy: bindTool("issues_by_taxonomy", findIssuesByTaxonomy),
};
export const issueTools: (ToolDefinition & { handler: ToolHandler })[] = definitions.map((tool) => ({
  ...tool,
  handler: handlers[tool.name],
}));
