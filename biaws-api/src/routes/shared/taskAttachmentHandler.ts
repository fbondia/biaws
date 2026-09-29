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
    const files =
      "uploaded" in result
        ? result.uploaded
        : "attachment" in result
          ? [result.attachment]
          : "deleted" in result
            ? [result.deleted]
            : [];
    for (const file of files)
      await recordAuditEvent({
        actor: req.actor,
        action:
          operation === "upload"
            ? "attachment_added"
            : operation === "tags"
              ? "attachment_tags_updated"
              : "attachment_deleted",
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
