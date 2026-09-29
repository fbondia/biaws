import { requireAllPermissions } from "../../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../../shared/resourceReadHandler.js";
import { readRequestAttachmentResource } from "../../../../repositories/requests/index.js";

export function registerListTasksAttachmentsMetadata(router) {
  router.get(
    "/:id/tasks/:taskId/attachments/:attachmentId/metadata",
    requireAllPermissions("tasks.attachment.read"),
    createResourceReadHandler(
      "demand",
      "tasks.attachment.read",
      async (req, query) => {
        return readRequestAttachmentResource(req.params.id, req.params, query);
      },
    ),
  );
}
