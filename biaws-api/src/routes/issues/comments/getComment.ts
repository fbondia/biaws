import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readIssueResource } from "../../../repositories/issues/index.js";

export function registerGetComment(router: Router) {
  router.get(
    "/:id/comments/:commentId",
    requireAllPermissions("issues.read"),
    createResourceReadHandler(
      "issue",
      "issues.read",
      async (req: Request, query: {} | undefined) => {
        const result = await readIssueResource(
          req.params.id,
          "comment",
          req.params,
          query,
        );
        return result;
      },
    ),
  );
}
