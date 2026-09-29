import { getIssueTaxonomy } from "../../repositories/issues/taxonomy.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "./helpers.js";

export function registerGetTaxonomy(router) {
  router.get(
    "/taxonomy",
    requireAllPermissions("taxonomy.read"),
    asyncHandler(async (req, res) => {
      const result = await getIssueTaxonomy(
        authorizationQuery(req.actor, "taxonomy.read", req.query),
      );

      if (!result.taxonomy) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Issue taxonomy not found",
          },
        });
        return;
      }

      res.json(result);
    }),
  );
}
