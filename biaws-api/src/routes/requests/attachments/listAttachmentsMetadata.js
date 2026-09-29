import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readRequestAttachmentResource } from "../../../repositories/requests/index.js";

export function registerListAttachmentsMetadata(router) {
  router.get(
    "/:id/attachments/:attachmentId/metadata",
    requireAllPermissions("demands.attachment.read"),
    createResourceReadHandler(
      "demand",
      "demands.attachment.read",
      async (req, query) => {
        return readRequestAttachmentResource(req.params.id, req.params, query);
      },
    ),
  );
}
