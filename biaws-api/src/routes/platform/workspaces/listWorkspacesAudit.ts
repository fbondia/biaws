import type { Router, Request, Response } from "express";
import { requirePlatformPermissions } from "../../../auth/authorizationMiddleware.js";
import { listAuditEvents } from "../../../repositories/audit/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerListWorkspacesAudit(router: Router) {
  router.get(
    "/workspaces/:workspaceId/audit",
    requirePlatformPermissions("platform.audit.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        events: await listAuditEvents("workspace", req.params.workspaceId, {
          limit:
            req.query.limit === undefined ? undefined : Number(req.query.limit),
        }),
      });
    }),
  );
}
