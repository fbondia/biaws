import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readIssueResource } from "../../../repositories/issues/index.js";

export function registerListComments(router) {
  router.get(
    "/:id/comments",
    requireAllPermissions("issues.read"),
    createResourceReadHandler("issue", "issues.read", async (req, query) => {
      const result = await readIssueResource(
        req.params.id,
        "comments",
        req.params,
        query,
      );
      return result;
    }),
  );
}
