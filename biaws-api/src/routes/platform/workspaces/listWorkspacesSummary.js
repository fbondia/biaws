import { getWorkspaceSummary } from "../../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerListWorkspacesSummary(router) {
  router.get(
    "/workspaces/:workspaceId/summary",
    asyncHandler(async (req, res) => {
      res.json({ summary: await getWorkspaceSummary(req.params.workspaceId) });
    }),
  );
}
