import type { Router, Request, Response } from "express";
import { publishSkill } from "../../repositories/skills/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerCreateSkill(router: Router) {
  router.post(
    "/",
    requireAllPermissions("skills.publish"),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await publishSkill(
        req.body,
        authorizationQuery(req.actor, "skills.publish", req.query),
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "published",
        target: {
          type: "skill",
          id: result.skill.skillId,
          label: result.skill.name,
        },
        after: result.skill,
        summary: `Skill publicada: ${result.skill.skillId}@${result.skill.version}`,
      });
      res.status(201).json(result);
    }),
  );
}
