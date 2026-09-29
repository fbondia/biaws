import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { createIntegration } from "../../../repositories/integrations/index.js";
import { auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateApplicationsIntegration(router: Router) {
  router.post(
    "/applications/:applicationId/integrations",
    requireAllPermissions("integrations.create"),
    requireApplicationAccess("integrations.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const integration = await createIntegration(
        req.params.applicationId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "integration",
        action: "created",
        after: integration,
      });
      res.status(201).json({ integration });
    }),
  );
}
