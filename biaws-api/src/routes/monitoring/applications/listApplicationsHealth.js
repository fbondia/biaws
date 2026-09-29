import {
  actorCanAccessApplication,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { getApplication } from "../../../repositories/catalog/index.js";
import { getApplicationMonitoringHealth } from "../../../repositories/monitoring/events/index.js";
import { getApplicationHealthMetric } from "../../../repositories/home/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListApplicationsHealth(router) {
  router.get(
    "/applications/:applicationId/health",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req, res) => {
      const application = await getApplication(req.params.applicationId, {
        workspaceId: req.actor.workspaceId,
      });
      if (
        !application ||
        !actorCanAccessApplication(req.actor, "runtimes.read", application.id)
      ) {
        res.status(404).json({
          error: {
            code: "APPLICATION_NOT_FOUND",
            message: "Application not found",
          },
        });
        return;
      }
      const [health, details] = await Promise.all([
        getApplicationMonitoringHealth(application.id, req.actor.workspaceId),
        getApplicationHealthMetric(req.actor, {
          applicationId: application.id,
          includeConfigured: req.query.includeConfigured === "true",
        }),
      ]);
      res.json({
        health: { ...health, details },
      });
    }),
  );
}
