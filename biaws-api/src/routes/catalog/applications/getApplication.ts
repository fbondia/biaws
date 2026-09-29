import type { Router, Request, Response } from "express";
import {
  actorCanAccessApplication,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { getApplication } from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerGetApplication(router: Router) {
  router.get(
    "/applications/:applicationId",
    requireAllPermissions("applications.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const application = actorCanAccessApplication(
        req.actor,
        "applications.read",
        req.params.applicationId,
      )
        ? await getApplication(req.params.applicationId, {
            workspaceId: req.actor.workspaceId,
          })
        : null;
      if (!application) {
        sendNotFound(res, "APPLICATION_NOT_FOUND", "Application not found");
        return;
      }
      res.json({ application });
    }),
  );
}
