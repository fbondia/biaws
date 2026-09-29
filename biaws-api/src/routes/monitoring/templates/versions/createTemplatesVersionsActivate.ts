import type { Router, Request, Response } from "express";
import { requireAllPermissions, requireWorkspaceScope } from "../../../../auth/authorizationMiddleware.js";
import {
  getMonitoringTemplate,
  setMonitoringTemplateStatus,
} from "../../../../repositories/monitoring/templates/index.js";
import { auditTemplateMutation, asyncHandler } from "../../helpers.js";

const status = "active";

export function registerCreateTemplatesVersionsActivate(router: Router) {
  router.post(
    "/templates/:templateId/versions/:version/activate",
    requireAllPermissions("runtimes.update"),
    requireWorkspaceScope("runtimes.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await getMonitoringTemplate(req.params.templateId, {
        version: req.params.version,
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      const template = await setMonitoringTemplateStatus(req.params.templateId, req.params.version, status, req.actor);
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
