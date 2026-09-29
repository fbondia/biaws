import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getServer, updateServer } from "../../../repositories/servers/index.js";
import { sendNotFound, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateServer(router: Router) {
  router.patch(
    "/servers/:serverId",
    requireAllPermissions("servers.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      if (!before) return sendNotFound(res, "server");
      const after = await updateServer(req.params.serverId, req.body, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
      await auditMutation({
        req,
        type: "server",
        action: "updated",
        before,
        after,
      });
      res.json({ server: after });
    }),
  );
}
