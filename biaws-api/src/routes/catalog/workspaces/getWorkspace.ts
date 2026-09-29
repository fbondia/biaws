import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getWorkspace } from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerGetWorkspace(router: Router) {
  router.get(
    "/workspaces/:workspaceId",
    requireAllPermissions("workspaces.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const workspace =
        req.params.workspaceId === req.actor.workspaceId ? await getWorkspace(req.params.workspaceId) : null;
      if (!workspace) {
        sendNotFound(res, "WORKSPACE_NOT_FOUND", "Workspace not found");
        return;
      }
      res.json({ workspace });
    }),
  );
}
