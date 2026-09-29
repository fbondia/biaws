import type { Router, Request, Response } from "express";
import { requireAllPermissions, requireWorkspaceScope } from "../../../auth/authorizationMiddleware.js";
import { createServer } from "../../../repositories/servers/index.js";
import { auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateWorkspacesServer(router: Router) {
  router.post(
    "/workspaces/:workspaceId/servers",
    requireAllPermissions("servers.create"),
    requireWorkspaceScope("servers.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const server = await createServer(req.params.workspaceId, req.body, req.actor);
      await auditMutation({
        req,
        type: "server",
        action: "created",
        after: server,
      });
      res.status(201).json({ server });
    }),
  );
}
