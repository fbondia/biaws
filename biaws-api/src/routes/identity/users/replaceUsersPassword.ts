import type { Router, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../../../auth/auth.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { requireWorkspaceUser } from "../helpers.js";

export function registerReplaceUsersPassword(router: Router) {
  router.put(
    "/users/:userId/password",
    requireAllPermissions("users.password.reset"),
    requireWorkspaceUser,
    asyncHandler(async (req: Request, res: Response) => {
      const auth = await getAuth();
      const result = await auth.api.setUserPassword({
        headers: fromNodeHeaders(req.headers),
        body: {
          userId: req.params.userId,
          newPassword: req.body.newPassword,
        },
      });
      await auth.api.revokeUserSessions({
        headers: fromNodeHeaders(req.headers),
        body: { userId: req.params.userId },
      });
      res.json(result);
    }),
  );
}
