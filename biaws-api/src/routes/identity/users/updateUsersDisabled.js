import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../../../auth/auth.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { requireWorkspaceUser } from "../helpers.js";

export function registerUpdateUsersDisabled(router) {
  router.patch(
    "/users/:userId/disabled",
    requireAllPermissions("users.disable"),
    requireWorkspaceUser,
    asyncHandler(async (req, res) => {
      const auth = await getAuth();
      const result = req.body.disabled
        ? await auth.api.banUser({
            headers: fromNodeHeaders(req.headers),
            body: {
              userId: req.params.userId,
              banReason: "Desativado administrativamente",
            },
          })
        : await auth.api.unbanUser({
            headers: fromNodeHeaders(req.headers),
            body: { userId: req.params.userId },
          });
      res.json(result);
    }),
  );
}
