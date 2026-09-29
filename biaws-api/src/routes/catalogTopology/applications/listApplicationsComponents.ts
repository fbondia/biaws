import type { Router, Request, Response } from "express";
import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { listComponents } from "../../../repositories/components/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListApplicationsComponents(router: Router) {
  router.get(
    "/applications/:applicationId/components",
    requireAllPermissions("components.read"),
    requireApplicationAccess("components.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listComponents(req.params.applicationId, req.query));
    }),
  );
}
