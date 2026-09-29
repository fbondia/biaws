import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { deleteComponent, getComponent } from "../../../repositories/components/index.js";
import { sendNotFound, scopedApplicationEntity, auditMutation, asyncHandler } from "../helpers.js";

const parameter = "componentId";

const permission = "components.archive";

const type = "component";

const getter = getComponent;

const remove = deleteComponent;

export function registerDeleteComponentsPermanent(router: Router) {
  router.delete(
    "/components/:componentId/permanent",
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
