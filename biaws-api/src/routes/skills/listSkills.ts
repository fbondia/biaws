import type { Router, Request, Response } from "express";
import { listSkills } from "../../repositories/skills/index.js";
import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListSkills(router: Router) {
  router.get(
    "/",
    requireAllPermissions("skills.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await listSkills(authorizationQuery(req.actor, "skills.read", req.query)));
    }),
  );
}
