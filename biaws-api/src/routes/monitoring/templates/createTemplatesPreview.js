import {
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../auth/authorizationMiddleware.js";
import { previewMonitoringTemplate } from "../../../repositories/monitoring/templates/index.js";
import { asyncHandler } from "../helpers.js";

export function registerCreateTemplatesPreview(router) {
  router.post(
    "/templates/preview",
    requireAllPermissions("runtimes.read"),
    requireWorkspaceScope("runtimes.read"),
    asyncHandler(async (req, res) => {
      res.json({ preview: await previewMonitoringTemplate(req.body) });
    }),
  );
}
