import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import { getMonitoringTemplate } from "../../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "../helpers.js";

export function registerGetTemplate(router) {
  router.get(
    "/templates/:templateId",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req, res) => {
      res.json({
        template: await getMonitoringTemplate(req.params.templateId, {
          ...req.query,
          workspaceId: req.actor.workspaceId,
        }),
      });
    }),
  );
}
