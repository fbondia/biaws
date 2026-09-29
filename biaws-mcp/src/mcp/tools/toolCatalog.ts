import type { ToolDefinition } from "./contracts.js";
import { attachmentTools } from "../../domains/attachments/schemas.js";
import { auditTools } from "../../domains/audit/schemas.js";
import { catalogTools } from "../../domains/catalog/schemas.js";
import { collectionTools } from "../../domains/collections/schemas.js";
import { demandTools } from "../../domains/demands/schemas.js";
import { issueTools } from "../../domains/issues/schemas.js";
import { knowledgeTools } from "../../domains/knowledge/schemas.js";
import { monitoringTools } from "../../domains/monitoring/schemas.js";
import { secretTools } from "../../domains/secrets/schemas.js";
export const toolDefinitions = [
  ...catalogTools,
  ...collectionTools,
  ...secretTools,
  ...knowledgeTools,
  ...attachmentTools,
  ...demandTools,
  ...auditTools,
  ...monitoringTools,
  ...issueTools,
] as const satisfies readonly ToolDefinition[];
