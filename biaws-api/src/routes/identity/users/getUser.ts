import type { Router, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../../../auth/auth.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getUserAccess } from "../../../repositories/access/index.js";
import { requireWorkspaceUser } from "../helpers.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerGetUser(router: Router) {
  router.get(
    "/users/:userId",
    requireAllPermissions("users.read"),
    requireWorkspaceUser,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = String(req.params.userId);
      const auth = await getAuth();
      const user = await auth.api.getUser({ headers: fromNodeHeaders(req.headers), query: { id: userId } });
      const access = await getUserAccess(userId, { workspaceId: req.actor.workspaceId ?? undefined });
      res.json({ user: { ...user, groupIds: access.groupIds } });
    }),
  );
}
