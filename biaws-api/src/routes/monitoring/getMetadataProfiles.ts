import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../auth/authorizationMiddleware.js";
import { listMonitoringMetadataProfiles } from "../../repositories/monitoring/metadataProfiles/index.js";
import { asyncHandler } from "./helpers.js";

export function registerGetMetadataProfiles(router: Router) {
  router.get(
    "/metadata-profiles",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        items: await listMonitoringMetadataProfiles(req.actor.workspaceId),
      });
    }),
  );
}
