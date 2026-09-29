import type { Router, Request, Response } from "express";
import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { listOptionLists } from "../../repositories/optionLists/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListOptionLists(router: Router) {
  router.get(
    "/",
    requireAllPermissions("option_lists.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listOptionLists(authorizationQuery(req.actor, "option_lists.read", req.query)));
    }),
  );
}
