import type { Router, Request, Response } from "express";
import { listAllWorkspaces } from "../../repositories/catalog/workspaces/platform.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListWorkspaces(router: Router) {
  router.get(
    "/workspaces",
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listAllWorkspaces(req.query));
    }),
  );
}
