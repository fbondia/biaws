import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { listDeployments } from "../../../repositories/deployments/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListApplicationsDeployments(router) {
  router.get(
    "/applications/:applicationId/deployments",
    requireAllPermissions("deployments.read"),
    requireApplicationAccess("deployments.read"),
    asyncHandler(async (req, res) => {
      res.json(await listDeployments(req.params.applicationId, req.query));
    }),
  );
}
