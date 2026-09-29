import { getRequest } from "../../repositories/requests/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, asyncHandler } from "./helpers.js";

export function registerGetRequest(router) {
  router.get(
    "/:id",
    requireAllPermissions("demands.read"),
    asyncHandler(async (req, res) => {
      res.json(
        await getRequest(req.params.id, scopedQuery(req, "demands.read")),
      );
    }),
  );
}
