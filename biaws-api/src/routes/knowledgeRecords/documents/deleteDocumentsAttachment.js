import { deleteAttachment } from "../../../services/attachmentService.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { asyncHandler, rootDocument } from "../../shared/attachmentHelpers.js";

const entityType = "documents";

const permissionPrefix = "documents";

const rootType = "document";

const scopedQuery = (req, suffix) =>
  authorizationQuery(req.actor, `documents.attachment.${suffix}`, req.query);

export function registerDeleteDocumentsAttachment(router) {
  router.delete(
    "/documents/:id/attachments/:attachmentId",
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
}
