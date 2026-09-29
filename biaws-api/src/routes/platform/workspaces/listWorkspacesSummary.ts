import type { Router, Request, Response } from "express";
import { getWorkspaceSummary } from "../../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerListWorkspacesSummary(router: Router) {
  router.get(
    "/workspaces/:workspaceId/summary",
    asyncHandler(async (req: Request, res: Response) => {
      res.json({ summary: await getWorkspaceSummary(req.params.workspaceId) });
    }),
  );
}
