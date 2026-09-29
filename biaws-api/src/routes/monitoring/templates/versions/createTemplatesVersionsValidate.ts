import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../../auth/authorizationMiddleware.js";
import { validateMonitoringTemplateSample } from "../../../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "../../helpers.js";

export function registerCreateTemplatesVersionsValidate(router: Router) {
  router.post(
    "/templates/:templateId/versions/:version/validate",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        validation: await validateMonitoringTemplateSample(
          req.params.templateId,
          req.params.version,
          req.body,
          req.actor.workspaceId,
        ),
      });
    }),
  );
}
