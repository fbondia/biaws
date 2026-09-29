import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createRuntime, getDeployment } from "../../../repositories/deployments/index.js";
import { sendNotFound, scopedApplicationEntity, auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateDeploymentsRuntime(router: Router) {
  router.post(
    "/deployments/:deploymentId/runtimes",
    requireAllPermissions("runtimes.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const deployment = await scopedApplicationEntity(req, "runtimes.create", getDeployment, req.params.deploymentId);
      if (!deployment) return sendNotFound(res, "deployment");
      const runtime = await createRuntime(req.params.deploymentId, req.body, req.actor);
      await auditMutation({
        req,
        type: "runtime",
        action: "created",
        after: runtime,
      });
      res.status(201).json({ runtime });
    }),
  );
}
