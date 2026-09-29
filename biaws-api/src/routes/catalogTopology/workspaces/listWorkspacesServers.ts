import type { Router, Request, Response } from "express";
import { requireAllPermissions, requireWorkspaceScope } from "../../../auth/authorizationMiddleware.js";
import { listServers } from "../../../repositories/servers/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListWorkspacesServers(router: Router) {
  router.get(
    "/workspaces/:workspaceId/servers",
    requireAllPermissions("servers.read"),
    requireWorkspaceScope("servers.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listServers(req.params.workspaceId, req.query));
    }),
  );
}
