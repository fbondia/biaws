import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { listRepositories } from "../../../repositories/repositories/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListApplicationsRepositories(router) {
  router.get(
    "/applications/:applicationId/repositories",
    requireAllPermissions("repositories.read"),
    requireApplicationAccess("repositories.read"),
    asyncHandler(async (req, res) => {
      res.json(await listRepositories(req.params.applicationId, req.query));
    }),
  );
}
