import { setPermissionGroupActive } from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerUpdateGroupsStatus(router) {
  router.patch(
    "/groups/:groupId/status",
    requireAllPermissions("roles.manage"),
    asyncHandler(async (req, res) => {
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
