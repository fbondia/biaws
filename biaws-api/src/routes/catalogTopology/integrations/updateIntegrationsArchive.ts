import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  archiveIntegration,
  getIntegration,
} from "../../../repositories/integrations/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateIntegrationsArchive(router: Router) {
  router.patch(
    "/integrations/:integrationId/archive",
    requireAllPermissions("integrations.archive"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await scopedApplicationEntity(
        req,
        "integrations.archive",
        getIntegration,
        req.params.integrationId,
      );
      if (!before) return sendNotFound(res, "integration");
      const after = await archiveIntegration(
        req.params.integrationId,
        req.actor,
      );
      if (!after) throw new Error("Mutation result is unavailable");
      if (before.status !== after.status) {
        await auditMutation({
          req,
          type: "integration",
          action: "archived",
          before,
          after,
        });
      }
      res.json({ integration: after });
    }),
  );
}
