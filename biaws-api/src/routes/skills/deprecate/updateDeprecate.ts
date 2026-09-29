import type { Router, Request, Response } from "express";
import { deprecateSkill, getSkill } from "../../../repositories/skills/index.js";
import { authorizationQuery, requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerUpdateDeprecate(router: Router) {
  router.patch(
    "/:skillId/:version/deprecate",
    requireAllPermissions("skills.deprecate"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = authorizationQuery(req.actor, "skills.deprecate", req.query);
      const before = (await getSkill(req.params.skillId, req.params.version, query)).skill;
      const result = await deprecateSkill(req.params.skillId, req.params.version, query);
      await recordAuditEvent({
        actor: req.actor,
        action: "deprecated",
        target: { type: "skill", id: req.params.skillId, label: before?.name },
        before,
        after: result.skill,
        summary: `Skill descontinuada: ${req.params.skillId}@${req.params.version}`,
      });
      res.json(result);
    }),
  );
}
