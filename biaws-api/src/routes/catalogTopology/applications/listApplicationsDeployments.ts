import type { Router, Request, Response } from "express";
import { requireAllPermissions, requireApplicationAccess } from "../../../auth/authorizationMiddleware.js";
import { listDeployments } from "../../../repositories/deployments/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListApplicationsDeployments(router: Router) {
  router.get(
    "/applications/:applicationId/deployments",
    requireAllPermissions("deployments.read"),
    requireApplicationAccess("deployments.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listDeployments(req.params.applicationId, req.query));
    }),
  );
}
