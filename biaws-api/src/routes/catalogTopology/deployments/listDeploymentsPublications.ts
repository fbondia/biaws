import type { Router, Request, Response } from "express";
import { pageResource } from "../../../repositories/shared/resourceReads.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getDeployment } from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerListDeploymentsPublications(router: Router) {
  router.get(
    "/deployments/:deploymentId/publications",
    requireAllPermissions("deployments.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const deployment = await scopedApplicationEntity(
        req,
        "deployments.read",
        getDeployment,
        req.params.deploymentId,
      );
      if (!deployment) return sendNotFound(res, "deployment");
      res.json({
        deploymentId: deployment.id,
        ...pageResource(deployment.publications || [], req.query),
      });
    }),
  );
}
