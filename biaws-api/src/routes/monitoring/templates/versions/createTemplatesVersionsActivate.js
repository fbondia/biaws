import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../../auth/authorizationMiddleware.js";
import {
  getMonitoringTemplate,
  setMonitoringTemplateStatus,
} from "../../../../repositories/monitoring/templates/index.js";
import { auditTemplateMutation, asyncHandler } from "../../helpers.js";

const status = "active";

export function registerCreateTemplatesVersionsActivate(router) {
  router.post(
    "/templates/:templateId/versions/:version/activate",
    requireAllPermissions("runtimes.update"),
    requireWorkspaceScope("runtimes.update"),
    asyncHandler(async (req, res) => {
      const before = await getMonitoringTemplate(req.params.templateId, {
        version: req.params.version,
        workspaceId: req.actor.workspaceId,
      });
      const template = await setMonitoringTemplateStatus(
        req.params.templateId,
        req.params.version,
        status,
        req.actor,
      );
      await auditTemplateMutation({
        req,
        action: status === "active" ? "activated" : "deactivated",
        before,
        after: template,
      });
      res.json({ template });
    }),
  );
}
