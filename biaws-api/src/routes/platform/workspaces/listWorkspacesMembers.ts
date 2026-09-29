import type { Router, Request, Response } from "express";
import { listWorkspaceMembers } from "../../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerListWorkspacesMembers(router: Router) {
  router.get(
    "/workspaces/:workspaceId/members",
    asyncHandler(async (req: Request, res: Response) => {
      res.json({ members: await listWorkspaceMembers(req.params.workspaceId) });
    }),
  );
}
