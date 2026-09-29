import type { Router, Request, Response } from "express";
import { requireAllPermissions, requireApplicationAccess } from "../../../auth/authorizationMiddleware.js";
import { createDeployment } from "../../../repositories/deployments/index.js";
import { auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateApplicationsDeployment(router: Router) {
  router.post(
    "/applications/:applicationId/deployments",
    requireAllPermissions("deployments.create"),
    requireApplicationAccess("deployments.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const deployment = await createDeployment(req.params.applicationId, req.body, req.actor);
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
