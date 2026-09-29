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

export function registerUpdateComponentsArchive(router) {
  router.patch(
    "/components/:componentId/archive",
    requireAllPermissions("components.archive"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "components.archive",
        getComponent,
        req.params.componentId,
      );
      if (!before) return sendNotFound(res, "component");
      const after = await archiveComponent(req.params.componentId, req.actor);
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
