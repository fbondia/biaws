import { bindTool } from "../../bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../contracts.js";
import { attachmentTools as definitions } from "./schemas.js";
import {
  deleteAttachment,
  downloadAttachment,
  updateAttachmentTags,
  uploadAttachments,
} from "./service.js";
const handlers: Record<string, ToolHandler> = {
  attachments_upload: bindTool("attachments_upload", uploadAttachments),
  attachments_download: bindTool("attachments_download", downloadAttachment),
  attachments_update_tags: bindTool(
    "attachments_update_tags",
    updateAttachmentTags,
  ),
  attachments_delete: bindTool("attachments_delete", deleteAttachment),
};
export const attachmentTools: (ToolDefinition & { handler: ToolHandler })[] =
  definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
