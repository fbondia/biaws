import type { Router, Request, Response } from "express";
import { listPermissionGroups } from "../../../repositories/access/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerListWorkspacesGroups(router: Router) {
  router.get(
    "/workspaces/:workspaceId/groups",
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        groups: await listPermissionGroups({
          workspaceId: String(req.params.workspaceId),
          includeInactive: true,
        }),
      });
    }),
  );
}
