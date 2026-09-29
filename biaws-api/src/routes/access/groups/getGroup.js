import { getPermissionGroup } from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerGetGroup(router) {
  router.get(
    "/groups/:groupId",
    requireAllPermissions("roles.read"),
    asyncHandler(async (req, res) => {
      const group = await getPermissionGroup(req.params.groupId, {
        workspaceId: req.actor.workspaceId,
      });
      if (!group) {
        res.status(404).json({
          error: {
            code: "GROUP_NOT_FOUND",
            message: `Group not found: ${req.params.groupId}`,
          },
        });
        return;
      }
      res.json({ group });
    }),
  );
}
