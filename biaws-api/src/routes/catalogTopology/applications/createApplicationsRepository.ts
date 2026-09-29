import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { createRepository } from "../../../repositories/repositories/index.js";
import { auditMutation, asyncHandler } from "../helpers.js";

export function registerCreateApplicationsRepository(router: Router) {
  router.post(
    "/applications/:applicationId/repositories",
    requireAllPermissions("repositories.create"),
    requireApplicationAccess("repositories.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const repository = await createRepository(
        req.params.applicationId,
        req.body,
        req.actor,
      );
      await auditMutation({
        req,
        type: "repository",
        action: "created",
        after: repository,
      });
      res.status(201).json({ repository });
    }),
  );
}
