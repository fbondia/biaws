import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  archiveComponent,
  getComponent,
} from "../../../repositories/components/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateComponentsArchive(router: Router) {
  router.patch(
    "/components/:componentId/archive",
    requireAllPermissions("components.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await scopedApplicationEntity(
        req,
        "components.archive",
        getComponent,
        req.params.componentId,
      );
      if (!before) return sendNotFound(res, "component");
      const after = await archiveComponent(req.params.componentId, req.actor);
      if (!after) throw new Error("Mutation result is unavailable");
      if (before.status !== after.status) {
        await auditMutation({
          req,
          type: "component",
          action: "archived",
          before,
          after,
        });
      }
      res.json({ component: after });
    }),
  );
}
