import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { listIntegrations } from "../../../repositories/integrations/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListApplicationsIntegrations(router) {
  router.get(
    "/applications/:applicationId/integrations",
    requireAllPermissions("integrations.read"),
    requireApplicationAccess("integrations.read"),
    asyncHandler(async (req, res) => {
      res.json(await listIntegrations(req.params.applicationId, req.query));
    }),
  );
}
