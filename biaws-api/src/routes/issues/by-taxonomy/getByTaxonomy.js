import { listIssuesByTaxonomy } from "../../../repositories/issues/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../helpers.js";

export function registerGetByTaxonomy(router) {
  router.get(
    "/by-taxonomy/:taxonomyId",
    requireAllPermissions("issues.read"),
    asyncHandler(async (req, res) => {
      res.json(
        await listIssuesByTaxonomy(
          req.params.taxonomyId,
          authorizationQuery(req.actor, "issues.read", req.query),
        ),
      );
    }),
  );
}
