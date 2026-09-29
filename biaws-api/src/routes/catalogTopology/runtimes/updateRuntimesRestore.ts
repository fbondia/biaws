import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getRuntime, restoreRuntime } from "../../../repositories/deployments/index.js";
import { sendNotFound, scopedApplicationEntity, auditMutation, asyncHandler } from "../helpers.js";

const parameter = "runtimeId";

const permission = "runtimes.archive";

const type = "runtime";

const response = "runtime";

const getter = getRuntime;

const restore = restoreRuntime;

export function registerUpdateRuntimesRestore(router: Router) {
  router.patch(
    "/runtimes/:runtimeId/restore",
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
