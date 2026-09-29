import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getDeployment,
  updateDeployment,
} from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateDeployment(router) {
  router.patch(
    "/deployments/:deploymentId",
    requireAllPermissions("deployments.update"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "deployments.update",
        getDeployment,
        req.params.deploymentId,
      );
      if (!before) return sendNotFound(res, "deployment");
      const after = await updateDeployment(
        req.params.deploymentId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "deployment",
        action: "updated",
        before,
        after,
      });
      res.json({ deployment: after });
    }),
  );
}
