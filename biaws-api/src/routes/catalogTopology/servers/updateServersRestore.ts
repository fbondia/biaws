import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getServer,
  restoreServer,
} from "../../../repositories/servers/index.js";
import { sendNotFound, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateServersRestore(router: Router) {
  router.patch(
    "/servers/:serverId/restore",
    requireAllPermissions("servers.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      if (!before) return sendNotFound(res, "server");
      const after = await restoreServer(req.params.serverId, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
      if (before.status !== after.status) {
        await auditMutation({
          req,
          type: "server",
          action: "restored",
          before,
          after,
        });
      }
      res.json({ server: after });
    }),
  );
}
