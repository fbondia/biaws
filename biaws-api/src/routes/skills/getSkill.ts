import type { Router, Request, Response } from "express";
import { getSkill } from "../../repositories/skills/index.js";
import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";
import { sendNotFound } from "./helpers.js";

export function registerGetSkill(router: Router) {
  router.get(
    "/:skillId",
    requireAllPermissions("skills.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await getSkill(
        req.params.skillId,
        req.query.version,
        authorizationQuery(req.actor, "skills.read", req.query),
      );
      if (!result.skill) return sendNotFound(res, req.params.skillId, req.query.version);
      res.json(result);
    }),
  );
}
