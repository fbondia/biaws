import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  archiveDeployment,
  getDeployment,
} from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateDeploymentsArchive(router: Router) {
  router.patch(
    "/deployments/:deploymentId/archive",
    requireAllPermissions("deployments.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await scopedApplicationEntity(
        req,
        "deployments.archive",
        getDeployment,
        req.params.deploymentId,
      );
      if (!before) return sendNotFound(res, "deployment");
      const after = await archiveDeployment(req.params.deploymentId, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
      if (before.status !== after.status) {
        await auditMutation({
          req,
          type: "deployment",
          action: "archived",
          before,
          after,
        });
      }
      res.json({ deployment: after });
    }),
  );
}
