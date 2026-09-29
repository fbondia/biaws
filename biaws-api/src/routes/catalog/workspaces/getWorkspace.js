import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getWorkspace } from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerGetWorkspace(router) {
  router.get(
    "/workspaces/:workspaceId",
    requireAllPermissions("workspaces.read"),
    asyncHandler(async (req, res) => {
      const workspace =
        req.params.workspaceId === req.actor.workspaceId
          ? await getWorkspace(req.params.workspaceId)
          : null;
      if (!workspace) {
        sendNotFound(res, "WORKSPACE_NOT_FOUND", "Workspace not found");
        return;
      }
      res.json({ workspace });
    }),
  );
}
