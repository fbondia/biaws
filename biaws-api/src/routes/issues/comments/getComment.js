import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readIssueResource } from "../../../repositories/issues/index.js";

export function registerGetComment(router) {
  router.get(
    "/:id/comments/:commentId",
    requireAllPermissions("issues.read"),
    createResourceReadHandler("issue", "issues.read", async (req, query) => {
      const result = await readIssueResource(
        req.params.id,
        "comment",
        req.params,
        query,
      );
      return result;
    }),
  );
}
