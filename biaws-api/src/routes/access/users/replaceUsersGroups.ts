import type { Router, Request, Response } from "express";
import { setUserGroups } from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerReplaceUsersGroups(router: Router) {
  router.put(
    "/users/:userId/groups",
    requireAllPermissions("users.update", "roles.manage"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        access: await setUserGroups(
          String(req.params.userId),
          req.body.groupIds,
          req.actor,
          { workspaceId: req.actor.workspaceId ?? undefined },
        ),
      });
    }),
  );
}
