import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  deleteRuntime,
  getRuntime,
} from "../../../repositories/deployments/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

const parameter = "runtimeId";

const permission = "runtimes.archive";

const type = "runtime";

const getter = getRuntime;

const remove = deleteRuntime;

export function registerDeleteRuntimesPermanent(router: Router) {
  router.delete(
    "/runtimes/:runtimeId/permanent",
    requireAllPermissions(permission),
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params[parameter];
      const before = await scopedApplicationEntity(req, permission, getter, id);
      if (!before) return sendNotFound(res, type);
      await remove(id);
      await auditMutation({
        req,
        type,
        action: "deleted",
        before,
        after: null,
      });
      res.json({ deleted: true, id: before.id });
    }),
  );
}
