import type { Request, Router, Response } from "express";
import { updateAttachmentTags } from "../../../services/attachmentService.js";
import { authorizationQuery, requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { asyncHandler, rootDocument } from "../../shared/attachmentHelpers.js";

const entityType = "requests";

const permissionPrefix = "demands";

const rootType = "demand";

const scopedQuery = (req: Request, suffix: string) =>
  authorizationQuery(req.actor, `demands.attachment.${suffix}`, req.query);

export function registerUpdateAttachmentsTags(router: Router) {
  router.patch(
    "/:id/attachments/:attachmentId/tags",
    requireAllPermissions(`${permissionPrefix}.attachment.update`),
    asyncHandler(async (req: Request, res: Response) => {
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
