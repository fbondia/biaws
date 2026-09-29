import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  archiveServer,
  getServer,
} from "../../../repositories/servers/index.js";
import { sendNotFound, auditMutation, asyncHandler } from "../helpers.js";

export function registerUpdateServersArchive(router) {
  router.patch(
    "/servers/:serverId/archive",
    requireAllPermissions("servers.archive"),
    asyncHandler(async (req, res) => {
      const before = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId,
      });
      if (!before) return sendNotFound(res, "server");
      const after = await archiveServer(req.params.serverId, req.actor);
      if (before.status !== after.status) {
        await auditMutation({
          req,
          type: "server",
          action: "archived",
          before,
          after,
        });
      }
      res.json({ server: after });
    }),
  );
}
