import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import { listServers } from "../../../repositories/servers/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListWorkspacesServers(router) {
  router.get(
    "/workspaces/:workspaceId/servers",
    requireAllPermissions("servers.read"),
    requireWorkspaceScope("servers.read"),
    asyncHandler(async (req, res) => {
      res.json(await listServers(req.params.workspaceId, req.query));
    }),
  );
}
