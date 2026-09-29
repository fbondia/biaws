import type { Router, Request, Response } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { changeWorkspaceStatus } from "../helpers.js";

export function registerCreateWorkspacesArchive(router: Router) {
  router.post(
    "/workspaces/:workspaceId/archive",
    asyncHandler((req: Request, res: Response) => changeWorkspaceStatus(req, res, "archived")),
  );
}
