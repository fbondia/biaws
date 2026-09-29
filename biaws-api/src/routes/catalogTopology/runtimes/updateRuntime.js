import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getRuntime,
  updateRuntime,
} from "../../../repositories/deployments/index.js";
import { recalculateRuntimeMonitoringExpiration } from "../../../repositories/monitoring/events/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateRuntime(router) {
  router.patch(
    "/runtimes/:runtimeId",
    requireAllPermissions("runtimes.update"),
    asyncHandler(async (req, res) => {
      const before = await scopedApplicationEntity(
        req,
        "runtimes.update",
        getRuntime,
        req.params.runtimeId,
      );
      if (!before) return sendNotFound(res, "runtime");
      const after = await updateRuntime(
        req.params.runtimeId,
        req.body,
        req.actor,
      );
      if (before.monitoringRetentionDays !== after.monitoringRetentionDays) {
        await recalculateRuntimeMonitoringExpiration(
          after.id,
          after.monitoringRetentionDays,
          { workspaceId: req.actor.workspaceId },
        );
      }
      await auditMutation({
        req,
        type: "runtime",
        action: "updated",
        before,
        after,
      });
      res.json({ runtime: after });
    }),
  );
}
