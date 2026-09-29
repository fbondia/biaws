import { getUserAccess } from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerGetUser(router) {
  router.get(
    "/users/:userId",
    requireAllPermissions("users.read"),
    asyncHandler(async (req, res) => {
      res.json({
        access: await getUserAccess(req.params.userId, {
          workspaceId: req.actor.workspaceId,
        }),
      });
    }),
  );
}
