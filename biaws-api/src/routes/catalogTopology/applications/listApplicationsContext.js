import {
  requireAllPermissions,
  requireApplicationPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { getApplicationContext } from "../../../repositories/catalog/applications/context.js";
import { asyncHandler } from "../helpers.js";

export function registerListApplicationsContext(router) {
  router.get(
    "/applications/:applicationId/context",
    requireAllPermissions(
      "applications.read",
      "integrations.read",
      "components.read",
      "repositories.read",
      "servers.read",
      "deployments.read",
      "runtimes.read",
      "issues.read",
      "demands.read",
      "documents.read",
    ),
    requireApplicationPermissions(
      "applications.read",
      "integrations.read",
      "components.read",
      "repositories.read",
      "deployments.read",
      "runtimes.read",
      "issues.read",
      "demands.read",
      "documents.read",
    ),
    asyncHandler(async (req, res) => {
      res.json(
        await getApplicationContext(req.params.applicationId, req.query),
      );
    }),
  );
}
