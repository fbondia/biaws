import type { Router, Request, Response } from "express";
import { listIssues } from "../../repositories/issues/index.js";
import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "./helpers.js";

export function registerListIssues(router: Router) {
  router.get(
    "/",
    requireAllPermissions("issues.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listIssues(authorizationQuery(req.actor, "issues.read", req.query)));
    }),
  );
}
