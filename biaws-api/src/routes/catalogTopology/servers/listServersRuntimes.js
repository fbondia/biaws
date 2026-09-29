import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import {
  getServer,
  listServerRuntimes,
} from "../../../repositories/servers/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerListServersRuntimes(router) {
  router.get(
    "/servers/:serverId/runtimes",
    requireAllPermissions("servers.read", "runtimes.read"),
    asyncHandler(async (req, res) => {
      const server = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId,
      });
      if (!server) return sendNotFound(res, "server");
      res.json(
        await listServerRuntimes(
          req.params.serverId,
          authorizationQuery(req.actor, "runtimes.read", req.query),
        ),
      );
    }),
  );
}
