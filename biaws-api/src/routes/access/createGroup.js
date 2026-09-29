import { createPermissionGroup } from "../../repositories/access/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerCreateGroup(router) {
  router.post(
    "/groups",
    requireAllPermissions("roles.manage"),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        group: await createPermissionGroup(req.body, req.actor),
      });
    }),
  );
}
