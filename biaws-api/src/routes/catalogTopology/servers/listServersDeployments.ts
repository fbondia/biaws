import type { Router, Request, Response } from "express";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import {
  getServer,
  listServerDeployments,
} from "../../../repositories/servers/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerListServersDeployments(router: Router) {
  router.get(
    "/servers/:serverId/deployments",
    requireAllPermissions("servers.read", "deployments.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const server = await getServer(req.params.serverId, {
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      if (!server) return sendNotFound(res, "server");
      res.json(
        await listServerDeployments(
          req.params.serverId,
          authorizationQuery(req.actor, "deployments.read", req.query),
        ),
      );
    }),
  );
}
