import type { Request, Router, Response } from "express";
import { uploadAttachments } from "../../../services/attachmentService.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import {
  asyncHandler,
  rootDocument,
  upload,
} from "../../shared/attachmentHelpers.js";

const entityType = "documents";

const permissionPrefix = "documents";

const rootType = "document";

const scopedQuery = (req: Request, suffix: string) =>
  authorizationQuery(req.actor, `documents.attachment.${suffix}`, req.query);

export function registerCreateDocumentsAttachment(router: Router) {
  router.post(
    "/documents/:id/attachments",
    requireAllPermissions(`${permissionPrefix}.attachment.create`),
    upload.array("files", 10),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await uploadAttachments(
        entityType,
        String(req.params.id),
        Array.isArray(req.files) ? req.files : [],
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
}
