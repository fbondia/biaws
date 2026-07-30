import multer from "multer";

import { getServerConfig } from "../config.js";
import {
  deleteAttachment,
  readAttachment,
  updateAttachmentTags,
  uploadAttachments,
} from "../services/attachmentService.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import { knowledgeContextMetadata } from "../repositories/knowledgeContextRepository.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: getServerConfig().maxAttachmentBytes,
    files: 10,
  },
});

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function rootDocument(result, entityType) {
  const key =
    entityType === "requests"
      ? "request"
      : entityType === "issues"
        ? "issue"
        : "procedure";
  return result?.[key];
}

export function registerAttachmentRoutes(router, entityType) {
  const permissionPrefix = entityType === "requests" ? "demands" : entityType;
  const rootType =
    entityType === "requests"
      ? "demand"
      : entityType === "issues"
        ? "issue"
        : "procedure";
  const scopedQuery = (req, suffix) =>
    authorizationQuery(
      req.actor,
      `${permissionPrefix}.attachment.${suffix}`,
      req.query,
    );
  router.post(
    "/:id/attachments",
    requireAllPermissions(`${permissionPrefix}.attachment.create`),
    upload.array("files", 10),
    asyncHandler(async (req, res) => {
      const result = await uploadAttachments(
        entityType,
        req.params.id,
        req.files,
        scopedQuery(req, "create"),
        req.body?.tags,
      );
      for (const attachment of result.uploaded || []) {
        await recordAuditEvent({
          actor: req.actor,
          action: "attachment_added",
          target: {
            type: "attachment",
            id: attachment.id,
            label: attachment.filename,
          },
          root: { type: rootType, id: req.params.id },
          after: attachment,
          summary: `Anexo adicionado: ${attachment.filename}`,
          metadata: knowledgeContextMetadata(rootDocument(result, entityType)),
        });
      }
      res.status(201).json(result);
    }),
  );

  router.get(
    "/:id/attachments/:attachmentId",
    requireAllPermissions(`${permissionPrefix}.attachment.read`),
    asyncHandler(async (req, res) => {
      const { attachment, content } = await readAttachment(
        entityType,
        req.params.id,
        req.params.attachmentId,
        scopedQuery(req, "read"),
      );
      const fallbackName = String(attachment.filename || "anexo").replace(
        /[\r\n"]/gu,
        "_",
      );
      const encodedName = encodeURIComponent(attachment.filename || "anexo");
      res.set({
        "Content-Type": attachment.contentType || "application/octet-stream",
        "Content-Length": String(content.length),
        "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
      });
      res.send(content);
    }),
  );

  router.delete(
    "/:id/attachments/:attachmentId",
    requireAllPermissions(`${permissionPrefix}.attachment.delete`),
    asyncHandler(async (req, res) => {
      const result = await deleteAttachment(
        entityType,
        req.params.id,
        req.params.attachmentId,
        scopedQuery(req, "delete"),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "attachment_deleted",
        target: {
          type: "attachment",
          id: result.deleted.id || result.deleted.index,
          label: result.deleted.filename,
        },
        root: { type: rootType, id: req.params.id },
        before: result.deleted,
        summary: `Anexo excluído: ${result.deleted.filename}`,
        metadata: knowledgeContextMetadata(rootDocument(result, entityType)),
      });
      res.json(result);
    }),
  );

  router.patch(
    "/:id/attachments/:attachmentId/tags",
    requireAllPermissions(`${permissionPrefix}.attachment.update`),
    asyncHandler(async (req, res) => {
      const result = await updateAttachmentTags(
        entityType,
        req.params.id,
        req.params.attachmentId,
        req.body.tags,
        scopedQuery(req, "update"),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "attachment_tags_updated",
        target: {
          type: "attachment",
          id: result.attachment.id || result.attachment.index,
          label: result.attachment.filename,
        },
        root: { type: rootType, id: req.params.id },
        before: { tags: result.attachment.previousTags },
        after: { tags: result.attachment.tags },
        summary: `Tags do anexo atualizadas: ${result.attachment.filename}`,
        metadata: knowledgeContextMetadata(rootDocument(result, entityType)),
      });
      res.json(result);
    }),
  );
}
