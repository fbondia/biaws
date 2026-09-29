import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { listAccessibleSecrets } from "../../services/secretsService.js";
import { asyncHandler } from "./helpers.js";

export function registerListSecrets(router: Router) {
  router.get(
    "/",
    requireAllPermissions("secrets.metadata.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listAccessibleSecrets(req.query, req.actor));
    }),
  );
}
