import { getWorkspace } from "../../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerGetWorkspace(router) {
  router.get(
    "/workspaces/:workspaceId",
    asyncHandler(async (req, res) => {
      const workspace = await getWorkspace(req.params.workspaceId);
      if (!workspace) {
        res.status(404).json({
          error: {
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace not found",
          },
        });
        return;
      }
      res.json({ workspace });
    }),
  );
}
