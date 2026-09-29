import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { listApplications } from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerListWorkspacesApplications(router) {
  router.get(
    "/workspaces/:workspaceId/applications",
    requireAllPermissions("applications.read"),
    (req, res, next) =>
      req.params.workspaceId === req.actor.workspaceId
        ? next()
        : sendNotFound(res, "WORKSPACE_NOT_FOUND", "Workspace not found"),
    asyncHandler(async (req, res) => {
      res.json(
        await listApplications(
          req.params.workspaceId,
          authorizationQuery(req.actor, "applications.read", req.query),
        ),
      );
    }),
  );
}
