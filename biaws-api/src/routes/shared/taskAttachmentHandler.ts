import type { Request, Response } from "express";
import multer from "multer";
import { getServerConfig } from "../../config.js";
import { authorizationQuery } from "../../auth/authorizationMiddleware.js";
import { mutateTaskAttachments } from "../../services/taskAttachmentsService.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../repositories/shared/knowledgeContext.js";
import { createReferenceHandler } from "./asyncHandler.js";

export const taskAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getServerConfig().maxAttachmentBytes, files: 10 },
});

const withDemandReferences = createReferenceHandler("demand");

function affectedFiles(
  result: Awaited<ReturnType<typeof mutateTaskAttachments>>,
) {
  if ("uploaded" in result) return result.uploaded;
  if ("attachment" in result) return [result.attachment];
  if ("deleted" in result) return [result.deleted];
  return [];
}

const auditActions = {
  upload: "attachment_added",
  tags: "attachment_tags_updated",
  delete: "attachment_deleted",
} as const;

export const createTaskAttachmentHandler = (
  operation: "upload" | "tags" | "delete",
  permission: string,
) =>
  withDemandReferences(async (req: Request, res: Response) => {
    const result = await mutateTaskAttachments(
      operation,
      req.params.id,
      req.params.taskId,
      {
        files: Array.isArray(req.files) ? req.files : [],
        tags: req.body.tags,
        attachmentId: req.params.attachmentId,
      },
      authorizationQuery(req.actor, permission, req.query),
    );
    for (const file of affectedFiles(result))
      await recordAuditEvent({
        actor: req.actor,
        action: auditActions[operation],
        target: {
          type: "attachment",
          id: file.id || file.index,
          label: file.filename,
        },
        root: { type: "demand", id: req.params.id },
        ...(operation === "delete" ? { before: file } : { after: file }),
        metadata: {
          ...knowledgeContextMetadata(result.request),
          taskId: req.params.taskId,
        },
        summary: "Anexo da tarefa atualizado",
      });
    res.status(operation === "upload" ? 201 : 200).json(result);
  });
