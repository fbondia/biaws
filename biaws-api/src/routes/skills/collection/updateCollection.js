import {
  getSkill,
  moveSkillToCollection,
} from "../../../repositories/skills/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { assertResourceCollection } from "../../../repositories/resourceCollections/index.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { sendNotFound } from "../helpers.js";

export function registerUpdateCollection(router) {
  router.patch(
    "/:skillId/collection",
    requireAllPermissions("skills.publish"),
    asyncHandler(async (req, res) => {
      const query = authorizationQuery(req.actor, "skills.publish", req.query);
      const before = (await getSkill(req.params.skillId, undefined, query))
        .skill;
      if (!before) return sendNotFound(res, req.params.skillId);
      const collectionId = await assertResourceCollection(
        "skills",
        req.body?.collectionId,
        req.actor.workspaceId,
      );
      const result = await moveSkillToCollection(
        req.params.skillId,
        collectionId,
        query,
      );
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: { type: "skill", id: req.params.skillId, label: before.name },
        before,
        after: result.skill,
        summary: `Skill movida entre coleções: ${before.name}`,
      });
      res.json(result);
    }),
  );
}
