import { listWorkspaceMembers } from "../../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerListWorkspacesMembers(router) {
  router.get(
    "/workspaces/:workspaceId/members",
    asyncHandler(async (req, res) => {
      res.json({ members: await listWorkspaceMembers(req.params.workspaceId) });
    }),
  );
}
