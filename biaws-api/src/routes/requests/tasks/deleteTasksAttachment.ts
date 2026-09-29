import type { Router } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createTaskAttachmentHandler } from "../../shared/taskAttachmentHandler.js";

export function registerDeleteTasksAttachment(router: Router) {
  router.delete(
    "/:id/tasks/:taskId/attachments/:attachmentId",
    requireAllPermissions("tasks.attachment.delete"),
    createTaskAttachmentHandler("delete", "tasks.attachment.delete"),
  );
}
