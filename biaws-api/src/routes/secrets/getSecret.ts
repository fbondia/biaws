import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { getAccessibleSecret } from "../../services/secretsService.js";
import { asyncHandler } from "./helpers.js";

export function registerGetSecret(router: Router) {
  router.get(
    "/:secretId",
    requireAllPermissions("secrets.metadata.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({
        secret: await getAccessibleSecret(req.params.secretId, req.actor),
      });
    }),
  );
}
