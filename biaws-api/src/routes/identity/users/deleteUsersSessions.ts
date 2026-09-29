import type { Router, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../../../auth/auth.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { requireWorkspaceUser } from "../helpers.js";

export function registerDeleteUsersSessions(router: Router) {
  router.delete(
    "/users/:userId/sessions",
    requireAllPermissions("users.update"),
    requireWorkspaceUser,
    asyncHandler(async (req: Request, res: Response) => {
      const auth = await getAuth();
      res.json(
        await auth.api.revokeUserSessions({
          headers: fromNodeHeaders(req.headers),
          body: { userId: req.params.userId },
        }),
      );
    }),
  );
}
