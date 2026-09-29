import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getIntegration,
  restoreIntegration,
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

const response = "integration";

const getter = getIntegration;

const restore = restoreIntegration;

export function registerUpdateIntegrationsRestore(router) {
  router.patch(
    "/integrations/:integrationId/restore",
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
