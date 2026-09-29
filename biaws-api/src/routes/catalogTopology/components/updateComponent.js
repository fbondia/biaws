import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getComponent,
  updateComponent,
} from "../../../repositories/components/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateComponent(router) {
  router.patch(
    "/components/:componentId",
    requireAllPermissions("components.update"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "components.update",
        getComponent,
        req.params.componentId,
      );
      if (!before) return sendNotFound(res, "component");
      const after = await updateComponent(
        req.params.componentId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "component",
        action: "updated",
        before,
        after,
      });
      res.json({ component: after });
    }),
  );
}
