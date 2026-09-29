import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getComponent,
  restoreComponent,
} from "../../../repositories/components/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

const parameter = "componentId";

const permission = "components.archive";

const type = "component";

const response = "component";

const getter = getComponent;

const restore = restoreComponent;

export function registerUpdateComponentsRestore(router) {
  router.patch(
    "/components/:componentId/restore",
    requireAllPermissions(permission),
    asyncHandler(async (req, res) => {
      const id = req.params[parameter];
      const before = await scopedApplicationEntity(req, permission, getter, id);
      if (!before) return sendNotFound(res, type);
      const after = await restore(id, req.actor);
      if (before.status !== after.status) {
        await auditMutation({ req, type, action: "restored", before, after });
      }
      res.json({ [response]: after });
    }),
  );
}
