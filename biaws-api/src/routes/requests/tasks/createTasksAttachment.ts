import type { Router } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  createTaskAttachmentHandler,
  taskAttachmentUpload,
} from "../../shared/taskAttachmentHandler.js";

export function registerCreateTasksAttachment(router: Router) {
  router.post(
    "/:id/tasks/:taskId/attachments",
    requireAllPermissions("tasks.attachment.create"),
    taskAttachmentUpload.array("files", 10),
    createTaskAttachmentHandler("upload", "tasks.attachment.create"),
  );
}
