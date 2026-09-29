import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getComponent } from "../../../repositories/components/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerGetComponent(router) {
  router.get(
    "/components/:componentId",
    requireAllPermissions("components.read"),
    asyncHandler(async (req, res) => {
      const component = await scopedApplicationEntity(
        req,
        "components.read",
        getComponent,
        req.params.componentId,
      );
      if (!component) return sendNotFound(res, "component");
      res.json({ component });
    }),
  );
}
