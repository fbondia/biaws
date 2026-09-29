import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getServer } from "../../../repositories/servers/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerGetServer(router: Router) {
  router.get(
    "/servers/:serverId",
    requireAllPermissions("servers.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const server = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      if (!server) return sendNotFound(res, "server");
      res.json({ server });
    }),
  );
}
