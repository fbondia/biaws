import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import {
  getServer,
  moveServerToCollection,
} from "../../../repositories/servers/index.js";
import { sendNotFound, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateServersCollection(router: Router) {
  router.patch(
    "/servers/:serverId/collection",
    requireAllPermissions("servers.update"),
    requireWorkspaceScope("servers.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      if (!before) return sendNotFound(res, "server");
      const after = await moveServerToCollection(
        req.params.serverId,
        req.body?.collectionId,
        req.actor,
      );
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
