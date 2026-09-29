import { listRequests } from "../../repositories/requests/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { scopedQuery, asyncHandler } from "./helpers.js";

export function registerListRequests(router) {
  router.get(
    "/",
    requireAllPermissions("demands.read"),
    asyncHandler(async (req, res) => {
      res.json(await listRequests(scopedQuery(req, "demands.read")));
    }),
  );
}
