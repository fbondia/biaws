import { readAggregateGroup } from "../../helpers/query.js";
import { aggregateIssues } from "../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "./helpers.js";

export function registerListAggregate(router) {
  router.get(
    "/aggregate",
    requireAllPermissions("issues.read"),
    asyncHandler(async (req, res) => {
      res.json(
        await aggregateIssues(
          authorizationQuery(req.actor, "issues.read", req.query),
          readAggregateGroup(req.query),
        ),
      );
    }),
  );
}
