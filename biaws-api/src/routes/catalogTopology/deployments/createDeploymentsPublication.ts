import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getDeployment, recordDeploymentPublication } from "../../../repositories/deployments/index.js";
import { sendNotFound, scopedApplicationEntity, auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateDeploymentsPublication(router: Router) {
  router.post(
    "/deployments/:deploymentId/publications",
    requireAllPermissions("deployments.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await scopedApplicationEntity(req, "deployments.update", getDeployment, req.params.deploymentId);
      if (!before) return sendNotFound(res, "deployment");
      const after = await recordDeploymentPublication(req.params.deploymentId, req.body, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
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
