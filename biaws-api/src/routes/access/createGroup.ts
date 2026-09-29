import type { Router, Request, Response } from "express";
import { createPermissionGroup } from "../../repositories/access/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerCreateGroup(router: Router) {
  router.post(
    "/groups",
    requireAllPermissions("roles.manage"),
    asyncHandler(async (req: Request, res: Response) => {
      res.status(201).json({
        group: await createPermissionGroup(req.body, req.actor),
      });
    }),
  );
}
