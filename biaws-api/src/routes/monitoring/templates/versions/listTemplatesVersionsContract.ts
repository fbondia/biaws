import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../../auth/authorizationMiddleware.js";
import { describeMonitoringTemplate } from "../../../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "../../helpers.js";

export function registerListTemplatesVersionsContract(router: Router) {
  router.get(
    "/templates/:templateId/versions/:version/contract",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
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
