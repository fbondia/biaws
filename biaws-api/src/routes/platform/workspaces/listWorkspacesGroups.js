import { listPermissionGroups } from "../../../repositories/access/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerListWorkspacesGroups(router) {
  router.get(
    "/workspaces/:workspaceId/groups",
    asyncHandler(async (req, res) => {
      res.json({
        groups: await listPermissionGroups({
          workspaceId: req.params.workspaceId,
          includeInactive: true,
        }),
      });
    }),
  );
}
