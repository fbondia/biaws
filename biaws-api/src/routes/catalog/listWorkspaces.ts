import type { Router, Request, Response } from "express";
import { listWorkspaces } from "../../repositories/catalog/index.js";
import { asyncHandler } from "./helpers.js";

export function registerListWorkspaces(router: Router) {
  router.get(
    "/workspaces",
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await listWorkspaces({
          workspaceIds: (req.actor.workspaces || []).map(({ id }) => id),
        }),
      );
    }),
  );
}
