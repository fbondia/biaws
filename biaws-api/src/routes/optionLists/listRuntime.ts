import type { Router, Request, Response } from "express";
import { listOptionLists } from "../../repositories/optionLists/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListRuntime(router: Router) {
  router.get(
    "/runtime",
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await listOptionLists({
          ...req.query,
          authorizationScope: {
            workspaceId: req.actor.workspaceId ?? undefined,
            workspace: true,
            applicationIds: [],
          },
        }),
      );
    }),
  );
}
