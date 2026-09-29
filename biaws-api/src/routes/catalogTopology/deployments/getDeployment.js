import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getDeployment } from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerGetDeployment(router) {
  router.get(
    "/deployments/:deploymentId",
    requireAllPermissions("deployments.read"),
    asyncHandler(async (req, res) => {
      const deployment = await scopedApplicationEntity(
        req,
        "deployments.read",
        getDeployment,
        req.params.deploymentId,
      );
      if (!deployment) return sendNotFound(res, "deployment");
      res.json({ deployment });
    }),
  );
}
