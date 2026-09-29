import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import { getMonitoringTemplate } from "../../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "../helpers.js";

export function registerGetTemplate(router: Router) {
  router.get(
    "/templates/:templateId",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        template: await getMonitoringTemplate(req.params.templateId, {
          ...req.query,
          workspaceId: req.actor.workspaceId ?? undefined,
        }),
      });
    }),
  );
}
