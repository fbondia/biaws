import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readRequestAttachmentResource } from "../../../repositories/requests/index.js";

export function registerListTasksAttachments(router: Router) {
  router.get(
    "/:id/tasks/:taskId/attachments",
    requireAllPermissions("tasks.attachment.read"),
    createResourceReadHandler(
      "demand",
      "tasks.attachment.read",
      async (req: Request, query: {} | undefined) => {
        return readRequestAttachmentResource(req.params.id, req.params, query);
      },
    ),
  );
}
