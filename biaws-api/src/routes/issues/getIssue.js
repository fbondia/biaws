import { getIssue } from "../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "./helpers.js";

export function registerGetIssue(router) {
  router.get(
    "/:id",
    requireAllPermissions("issues.read"),
    asyncHandler(async (req, res) => {
      const result = await getIssue(
        req.params.id,
        authorizationQuery(req.actor, "issues.read", req.query),
      );

      if (!result.issue) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: `Issue not found: ${req.params.id}`,
          },
        });
        return;
      }

      res.json(result);
    }),
  );
}
