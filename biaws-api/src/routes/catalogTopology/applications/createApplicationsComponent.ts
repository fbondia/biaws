import type { Router, Request, Response } from "express";
import { requireAllPermissions, requireApplicationAccess } from "../../../auth/authorizationMiddleware.js";
import { createComponent } from "../../../repositories/components/index.js";
import { auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateApplicationsComponent(router: Router) {
  router.post(
    "/applications/:applicationId/components",
    requireAllPermissions("components.create"),
    requireApplicationAccess("components.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const component = await createComponent(req.params.applicationId, req.body, req.actor);
      await auditMutation({
        req,
        type: "component",
        action: "created",
        after: component,
      });
      res.status(201).json({ component });
    }),
  );
}
