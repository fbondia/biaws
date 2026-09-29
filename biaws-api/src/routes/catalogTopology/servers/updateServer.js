import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getServer,
  updateServer,
} from "../../../repositories/servers/index.js";
import { sendNotFound, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateServer(router) {
  router.patch(
    "/servers/:serverId",
    requireAllPermissions("servers.update"),
    asyncHandler(async (req, res) => {
      const before = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId,
      });
      if (!before) return sendNotFound(res, "server");
      const after = await updateServer(
        req.params.serverId,
        req.body,
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
