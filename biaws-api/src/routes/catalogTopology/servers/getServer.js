import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getServer } from "../../../repositories/servers/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerGetServer(router) {
  router.get(
    "/servers/:serverId",
    requireAllPermissions("servers.read"),
    asyncHandler(async (req, res) => {
      const server = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId,
      });
      if (!server) return sendNotFound(res, "server");
      res.json({ server });
    }),
  );
}
