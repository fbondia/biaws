import { summarizeIssues } from "../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "./helpers.js";

export function registerGetSummary(router) {
  router.get(
    "/summary",
    requireAllPermissions("issues.read"),
    asyncHandler(async (req, res) => {
      res.json(
        await summarizeIssues(
          authorizationQuery(req.actor, "issues.read", req.query),
        ),
      );
    }),
  );
}
