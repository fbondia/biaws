import { listIssues } from "../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "./helpers.js";

export function registerListIssues(router) {
  router.get(
    "/",
    requireAllPermissions("issues.read"),
    asyncHandler(async (req, res) => {
      res.json(
        await listIssues(
          authorizationQuery(req.actor, "issues.read", req.query),
        ),
      );
    }),
  );
}
