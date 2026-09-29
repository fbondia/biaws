import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readIssueResource } from "../../../repositories/issues/index.js";

export function registerListClassification(router) {
  router.get(
    "/:id/classification",
    requireAllPermissions("issues.read"),
    createResourceReadHandler("issue", "issues.read", async (req, query) => {
      const result = await readIssueResource(
        req.params.id,
        "classification",
        req.params,
        query,
      );
      return result;
    }),
  );
}
