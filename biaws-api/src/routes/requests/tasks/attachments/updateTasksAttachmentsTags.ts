import type { Router } from "express";
import { requireAllPermissions } from "../../../../auth/authorizationMiddleware.js";
import { createTaskAttachmentHandler } from "../../../shared/taskAttachmentHandler.js";

export function registerUpdateTasksAttachmentsTags(router: Router) {
  router.patch(
    "/:id/tasks/:taskId/attachments/:attachmentId/tags",
    requireAllPermissions("tasks.attachment.update"),
    createTaskAttachmentHandler("tags", "tasks.attachment.update"),
  );
}
