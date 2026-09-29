import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { deleteServer, getServer } from "../../../repositories/servers/index.js";
import { sendNotFound, auditMutation, asyncHandler } from "../helpers.js";

export function registerDeleteServersPermanent(router: Router) {
  router.delete(
    "/servers/:serverId/permanent",
    requireAllPermissions("servers.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      if (!before) return sendNotFound(res, "server");
      await deleteServer(req.params.serverId);
      await auditMutation({
        req,
        type: "server",
        action: "deleted",
        before,
        after: null,
      });
      res.json({ deleted: true, id: before.id });
    }),
  );
}
