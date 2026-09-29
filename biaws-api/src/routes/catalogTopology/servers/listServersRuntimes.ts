import type { Router, Request, Response } from "express";
import { authorizationQuery, requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getServer, listServerRuntimes } from "../../../repositories/servers/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerListServersRuntimes(router: Router) {
  router.get(
    "/servers/:serverId/runtimes",
    requireAllPermissions("servers.read", "runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const server = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      if (!server) return sendNotFound(res, "server");
      res.json(
        await listServerRuntimes(req.params.serverId, authorizationQuery(req.actor, "runtimes.read", req.query)),
      );
    }),
  );
}
