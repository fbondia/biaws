import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../../auth/authorizationMiddleware.js";
import { monitoringTemplateUsage } from "../../../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "../../helpers.js";

export function registerListTemplatesVersionsUsage(router) {
  router.get(
    "/templates/:templateId/versions/:version/usage",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req, res) => {
      res.json({
        usage: await monitoringTemplateUsage(
          req.params.templateId,
          req.params.version,
          req.actor.workspaceId,
        ),
      });
    }),
  );
}
