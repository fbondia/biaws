import type { Router, Request, Response } from "express";
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

export function registerUpdateDeployment(router: Router) {
  router.patch(
    "/deployments/:deploymentId",
    requireAllPermissions("deployments.update"),
    asyncHandler(async (req: Request, res: Response) => {
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
      if (!after) throw new Error("Mutation result is unavailable");
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
