import type { Router, Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { changeWorkspaceStatus } from "../helpers.js";

export function registerCreateWorkspacesReactivate(router: Router) {
  router.post(
    "/workspaces/:workspaceId/reactivate",
    asyncHandler((req: Request, res: Response) => changeWorkspaceStatus(req, res, "active")),
  );
}
