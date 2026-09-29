import { listPermissionGroups } from "../../repositories/access/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListGroups(router) {
  router.get(
    "/groups",
    requireAllPermissions("roles.read"),
    asyncHandler(async (req, res) => {
      const includeInactive = req.query.includeInactive !== "false";
      res.json({
        groups: await listPermissionGroups({
          includeInactive,
          workspaceId: req.actor.workspaceId,
        }),
      });
    }),
  );
}
