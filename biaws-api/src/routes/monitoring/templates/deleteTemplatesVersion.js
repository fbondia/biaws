import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import {
  archiveMonitoringTemplate,
  getMonitoringTemplate,
} from "../../../repositories/monitoring/templates/index.js";
import { auditTemplateMutation, asyncHandler } from "../helpers.js";

export function registerDeleteTemplatesVersion(router) {
  router.delete(
    "/templates/:templateId/versions/:version",
    requireAllPermissions("runtimes.update"),
    requireWorkspaceScope("runtimes.update"),
    asyncHandler(async (req, res) => {
      const before = await getMonitoringTemplate(req.params.templateId, {
        version: req.params.version,
        workspaceId: req.actor.workspaceId,
      });
      const template = await archiveMonitoringTemplate(
        req.params.templateId,
        req.params.version,
        req.actor,
      );
      await auditTemplateMutation({
        req,
        action: "archived",
        before,
        after: template,
      });
      res.json({ template });
    }),
  );
}
