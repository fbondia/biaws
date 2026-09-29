import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getDeployment,
  recordDeploymentPublication,
} from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerCreateDeploymentsPublication(router) {
  router.post(
    "/deployments/:deploymentId/publications",
    requireAllPermissions("deployments.update"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "deployments.update",
        getDeployment,
        req.params.deploymentId,
      );
      if (!before) return sendNotFound(res, "deployment");
      const after = await recordDeploymentPublication(
        req.params.deploymentId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "deployment",
        action: "publication.recorded",
        before,
        after,
      });
      res.status(201).json({
        deployment: after,
        publication: after.publications.at(-1),
      });
    }),
  );
}
