import { requirePlatformPermissions } from "../../../auth/authorizationMiddleware.js";
import { listAuditEvents } from "../../../repositories/audit/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerListWorkspacesAudit(router) {
  router.get(
    "/workspaces/:workspaceId/audit",
    requirePlatformPermissions("platform.audit.read"),
    asyncHandler(async (req, res) => {
      res.json({
        events: await listAuditEvents("workspace", req.params.workspaceId, {
          limit: req.query.limit,
        }),
      });
    }),
  );
}
