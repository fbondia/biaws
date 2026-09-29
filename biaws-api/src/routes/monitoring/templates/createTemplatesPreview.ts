import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import { previewMonitoringTemplate } from "../../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "../helpers.js";

export function registerCreateTemplatesPreview(router: Router) {
  router.post(
    "/templates/preview",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({ preview: await previewMonitoringTemplate(req.body) });
    }),
  );
}
