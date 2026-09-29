import { readAttachment } from "../../../services/attachmentService.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/attachmentHelpers.js";

const entityType = "documents";

const permissionPrefix = "documents";

const rootType = "document";

const scopedQuery = (req, suffix) =>
  authorizationQuery(req.actor, `documents.attachment.${suffix}`, req.query);

export function registerGetDocumentsAttachment(router) {
  router.get(
    "/documents/:id/attachments/:attachmentId",
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
}
