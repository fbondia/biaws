import type { Router, Request, Response } from "express";
import { setPermissionGroupActive } from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerUpdateGroupsStatus(router: Router) {
  router.patch(
    "/groups/:groupId/status",
    requireAllPermissions("roles.manage"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        group: await setPermissionGroupActive(
          req.params.groupId,
          req.body.active,
          req.actor,
        ),
      });
    }),
  );
}
