import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  deleteIntegration,
  getIntegration,
} from "../../../repositories/integrations/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

const parameter = "integrationId";

const permission = "integrations.archive";

const type = "integration";

const getter = getIntegration;

const remove = deleteIntegration;

export function registerDeleteIntegrationsPermanent(router: Router) {
  router.delete(
    "/integrations/:integrationId/permanent",
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
