import type { Router, Request, Response } from "express";
import { getRequest } from "../../repositories/requests/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, asyncHandler } from "./helpers.js";

export function registerGetRequest(router: Router) {
  router.get(
    "/:id",
    requireAllPermissions("demands.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await getRequest(req.params.id, scopedQuery(req, "demands.read")),
      );
    }),
  );
}
