import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getIntegration,
  updateIntegration,
} from "../../../repositories/integrations/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateIntegration(router) {
  router.patch(
    "/integrations/:integrationId",
    requireAllPermissions("integrations.update"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "integrations.update",
        getIntegration,
        req.params.integrationId,
      );
      if (!before) return sendNotFound(res, "integration");
      const after = await updateIntegration(
        req.params.integrationId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "integration",
        action: "updated",
        before,
        after,
      });
      res.json({ integration: after });
    }),
  );
}
