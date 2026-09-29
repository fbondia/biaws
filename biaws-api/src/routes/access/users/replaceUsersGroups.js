import { setUserGroups } from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerReplaceUsersGroups(router) {
  router.put(
    "/users/:userId/groups",
    requireAllPermissions("users.update", "roles.manage"),
    asyncHandler(async (req, res) => {
      res.json({
        access: await setUserGroups(
          req.params.userId,
          req.body.groupIds,
          req.actor,
          { workspaceId: req.actor.workspaceId },
        ),
      });
    }),
  );
}
