import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getDeployment,
  listRuntimes,
} from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerListDeploymentsRuntimes(router: Router) {
  router.get(
    "/deployments/:deploymentId/runtimes",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const deployment = await scopedApplicationEntity(
        req,
        "runtimes.read",
        getDeployment,
        req.params.deploymentId,
      );
      if (!deployment) return sendNotFound(res, "deployment");
      res.json(await listRuntimes(req.params.deploymentId, req.query));
    }),
  );
}
