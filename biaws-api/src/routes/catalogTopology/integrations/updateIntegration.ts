import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getIntegration,
  updateIntegration,
} from "../../../repositories/integrations/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  auditMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateIntegration(router: Router) {
  router.patch(
    "/integrations/:integrationId",
    requireAllPermissions("integrations.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const before = await scopedApplicationEntity(
        req,
        "integrations.update",
        getIntegration,
        req.params.integrationId,
      );
      if (!before) return sendNotFound(res, "integration");
      const after = await updateIntegration(
        req.params.integrationId,
        req.body,
        req.actor,
      );
      if (!after) throw new Error("Mutation result is unavailable");
      await auditMutation({
        req,
        type: "integration",
        action: "updated",
        before,
        after,
      });
      res.json({ integration: after });
    }),
  );
}
