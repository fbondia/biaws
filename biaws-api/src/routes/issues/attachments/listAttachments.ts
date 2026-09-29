import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readIssueAttachmentResource } from "../../../repositories/issues/index.js";

export function registerListAttachments(router: Router) {
  router.get(
    "/:id/attachments",
    requireAllPermissions("issues.attachment.read"),
    createResourceReadHandler("issue", "issues.attachment.read", async (req: Request, query: {} | undefined) => {
      return readIssueAttachmentResource(req.params.id, req.params, query);
    }),
  );
}
