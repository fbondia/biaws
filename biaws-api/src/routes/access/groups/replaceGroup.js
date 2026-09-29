import { updatePermissionGroup } from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerReplaceGroup(router) {
  router.put(
    "/groups/:groupId",
    requireAllPermissions("roles.manage"),
    asyncHandler(async (req, res) => {
      res.json({
        group: await updatePermissionGroup(
          req.params.groupId,
          req.body,
          req.actor,
        ),
      });
    }),
  );
}
