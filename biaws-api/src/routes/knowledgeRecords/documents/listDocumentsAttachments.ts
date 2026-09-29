import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readDocumentAttachmentResource } from "../../../repositories/documents/index.js";

export function registerListDocumentsAttachments(router: Router) {
  router.get(
    "/documents/:id/attachments",
    requireAllPermissions("documents.attachment.read"),
    createResourceReadHandler(
      "document",
      "documents.attachment.read",
      async (req: Request, query: {} | undefined) => {
        return readDocumentAttachmentResource(req.params.id, req.params, query);
      },
    ),
  );
}
