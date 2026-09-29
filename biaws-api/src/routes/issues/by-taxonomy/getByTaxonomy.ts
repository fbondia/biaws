import type { Router, Request, Response } from "express";
import { listIssuesByTaxonomy } from "../../../repositories/issues/index.js";
import { authorizationQuery, requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../helpers.js";

export function registerGetByTaxonomy(router: Router) {
  router.get(
    "/by-taxonomy/:taxonomyId",
    requireAllPermissions("issues.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await listIssuesByTaxonomy(req.params.taxonomyId, authorizationQuery(req.actor, "issues.read", req.query)),
      );
    }),
  );
}
