import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../auth/authorizationMiddleware.js";
import { listMonitoringMetadataProfiles } from "../../repositories/monitoring/metadataProfiles/index.js";
import { asyncHandler } from "./helpers.js";

export function registerGetMetadataProfiles(router) {
  router.get(
    "/metadata-profiles",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req, res) => {
      res.json({
        items: await listMonitoringMetadataProfiles(req.actor.workspaceId),
      });
    }),
  );
}
