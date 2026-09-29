import type { Router, Request, Response } from "express";
import { readAggregateGroup } from "../../helpers/query.js";
import { aggregateIssues } from "../../repositories/issues/index.js";
import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "./helpers.js";

export function registerListAggregate(router: Router) {
  router.get(
    "/aggregate",
    requireAllPermissions("issues.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await aggregateIssues(authorizationQuery(req.actor, "issues.read", req.query), readAggregateGroup(req.query)),
      );
    }),
  );
}
