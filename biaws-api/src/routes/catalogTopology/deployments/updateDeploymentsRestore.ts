import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getDeployment, restoreDeployment } from "../../../repositories/deployments/index.js";
import { sendNotFound, scopedApplicationEntity, auditMutation, asyncHandler } from "../helpers.js";

const parameter = "deploymentId";

const permission = "deployments.archive";

const type = "deployment";

const response = "deployment";

const getter = getDeployment;

const restore = restoreDeployment;

export function registerUpdateDeploymentsRestore(router: Router) {
  router.patch(
    "/deployments/:deploymentId/restore",
    requireAllPermissions(permission),
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params[parameter];
      const before = await scopedApplicationEntity(req, permission, getter, id);
      if (!before) return sendNotFound(res, type);
      const after = await restore(id, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
      if (before.status !== after.status) {
        await auditMutation({ req, type, action: "restored", before, after });
      }
      res.json({ [response]: after });
    }),
  );
}
