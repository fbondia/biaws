import type { Router, Request, Response, NextFunction } from "express";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { listApplications } from "../../../repositories/catalog/index.js";
import { sendNotFound, asyncHandler } from "../helpers.js";

export function registerListWorkspacesApplications(router: Router) {
  router.get(
    "/workspaces/:workspaceId/applications",
    requireAllPermissions("applications.read"),
    (req: Request, res: Response, next: NextFunction) =>
      req.params.workspaceId === req.actor.workspaceId
        ? next()
        : sendNotFound(res, "WORKSPACE_NOT_FOUND", "Workspace not found"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(
        await listApplications(
          req.params.workspaceId,
          authorizationQuery(req.actor, "applications.read", req.query),
        ),
      );
    }),
  );
}
