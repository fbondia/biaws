import type { Router, Request, Response } from "express";
import { getUserAccess } from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerGetUser(router: Router) {
  router.get(
    "/users/:userId",
    requireAllPermissions("users.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        access: await getUserAccess(req.params.userId, {
          workspaceId: req.actor.workspaceId ?? undefined,
        }),
      });
    }),
  );
}
