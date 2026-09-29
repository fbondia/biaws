import type { Router, Request, Response } from "express";
import { requireAllPermissions, requireWorkspaceScope } from "../../auth/authorizationMiddleware.js";
import { listMonitoringTemplates } from "../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "./helpers.js";

export function registerListTemplates(router: Router) {
  router.get(
    "/templates",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await listMonitoringTemplates({
          ...req.query,
          workspaceId: req.actor.workspaceId ?? undefined,
        }),
      );
    }),
  );
}
