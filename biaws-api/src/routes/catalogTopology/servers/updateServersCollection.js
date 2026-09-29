import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import {
  getServer,
  moveServerToCollection,
} from "../../../repositories/servers/index.js";
import { sendNotFound, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateServersCollection(router) {
  router.patch(
    "/servers/:serverId/collection",
    requireAllPermissions("servers.update"),
    requireWorkspaceScope("servers.update"),
    asyncHandler(async (req, res) => {
      const before = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId,
      });
      if (!before) return sendNotFound(res, "server");
      const after = await moveServerToCollection(
        req.params.serverId,
        req.body?.collectionId,
        req.actor,
      );
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
