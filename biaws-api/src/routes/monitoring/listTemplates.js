import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../auth/authorizationMiddleware.js";
import { listMonitoringTemplates } from "../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "./helpers.js";

export function registerListTemplates(router) {
  router.get(
    "/templates",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req, res) => {
      res.json(
        await listMonitoringTemplates({
          ...req.query,
          workspaceId: req.actor.workspaceId,
        }),
      );
    }),
  );
}
