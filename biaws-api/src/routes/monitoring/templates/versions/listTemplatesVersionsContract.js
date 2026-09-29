import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../../auth/authorizationMiddleware.js";
import { describeMonitoringTemplate } from "../../../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "../../helpers.js";

export function registerListTemplatesVersionsContract(router) {
  router.get(
    "/templates/:templateId/versions/:version/contract",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req, res) => {
      res.json({
        contract: await describeMonitoringTemplate(
          req.params.templateId,
          req.params.version,
          req.actor.workspaceId,
        ),
      });
    }),
  );
}
