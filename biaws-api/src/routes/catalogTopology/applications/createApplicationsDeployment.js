import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { createDeployment } from "../../../repositories/deployments/index.js";
import { auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateApplicationsDeployment(router) {
  router.post(
    "/applications/:applicationId/deployments",
    requireAllPermissions("deployments.create"),
    requireApplicationAccess("deployments.create"),
    asyncHandler(async (req, res) => {
      const deployment = await createDeployment(
        req.params.applicationId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "deployment",
        action: "created",
        after: deployment,
      });
      res.status(201).json({ deployment });
    }),
  );
}
