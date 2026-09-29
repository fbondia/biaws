import { listRequestCollectionItems } from "../../repositories/requests/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, asyncHandler } from "./helpers.js";

export function registerListCollectionItems(router) {
  router.get(
    "/collection-items",
    requireAllPermissions("demands.read"),
    asyncHandler(async (req, res) => {
      res.json(
        await listRequestCollectionItems(scopedQuery(req, "demands.read")),
      );
    }),
  );
}
