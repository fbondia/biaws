import type { Router, Request, Response } from "express";
import { listRequestCollectionItems } from "../../repositories/requests/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, asyncHandler } from "./helpers.js";

export function registerListCollectionItems(router: Router) {
  router.get(
    "/collection-items",
    requireAllPermissions("demands.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await listRequestCollectionItems(scopedQuery(req, "demands.read")),
      );
    }),
  );
}
