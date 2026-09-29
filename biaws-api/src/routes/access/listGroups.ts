import type { Router, Request, Response } from "express";
import { listPermissionGroups } from "../../repositories/access/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListGroups(router: Router) {
  router.get(
    "/groups",
    requireAllPermissions("roles.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const includeInactive = req.query.includeInactive !== "false";
      res.json({
        groups: await listPermissionGroups({
          includeInactive,
          workspaceId: req.actor.workspaceId ?? undefined,
        }),
      });
    }),
  );
}
