import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getIntegration } from "../../../repositories/integrations/index.js";
import { sendNotFound, scopedApplicationEntity, asyncHandler } from "../helpers.js";

export function registerGetIntegration(router: Router) {
  router.get(
    "/integrations/:integrationId",
    requireAllPermissions("integrations.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const integration = await scopedApplicationEntity(
        req,
        "integrations.read",
        getIntegration,
        req.params.integrationId,
      );
      if (!integration) return sendNotFound(res, "integration");
      res.json({ integration });
    }),
  );
}
