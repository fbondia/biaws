import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import {
  createMonitoringTemplateVersion,
  getMonitoringTemplate,
} from "../../../repositories/monitoring/templates/index.js";
import { auditTemplateMutation, asyncHandler } from "../helpers.js";

export function registerUpdateTemplate(router) {
  router.patch(
    "/templates/:templateId",
    requireAllPermissions("runtimes.update"),
    requireWorkspaceScope("runtimes.update"),
    asyncHandler(async (req, res) => {
      const before = await getMonitoringTemplate(req.params.templateId, {
        workspaceId: req.actor.workspaceId,
      });
      const template = await createMonitoringTemplateVersion(
        req.params.templateId,
        req.body,
        req.actor,
      );
      await auditTemplateMutation({
        req,
        action: "version_created",
        before,
        after: template,
      });
      res.status(201).json({ template });
    }),
  );
}
