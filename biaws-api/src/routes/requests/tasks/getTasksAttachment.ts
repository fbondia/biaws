import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readRequestAttachmentResource } from "../../../repositories/requests/index.js";
import { readAttachment } from "../../../services/attachmentService.js";

export function registerGetTasksAttachment(router: Router) {
  router.get(
    "/:id/tasks/:taskId/attachments/:attachmentId",
    requireAllPermissions("tasks.attachment.read"),
    createResourceReadHandler("demand", "tasks.attachment.read", async (req: Request, query: {} | undefined) => {
      await readRequestAttachmentResource(req.params.id, req.params, query);
      const result = await readAttachment("requests", req.params.id, req.params.attachmentId, query);
      return {
        binary: true,
        content: result.content,
        contentType: result.attachment.contentType || "application/octet-stream",
      };
    }),
  );
}
