import type { Router, Request, Response } from "express";
import { listRequests } from "../../repositories/requests/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, asyncHandler } from "./helpers.js";

export function registerListRequests(router: Router) {
  router.get(
    "/",
    requireAllPermissions("demands.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listRequests(scopedQuery(req, "demands.read")));
    }),
  );
}
