import type { Router, Request, Response } from "express";
import {
  getSkill,
  publishSkill,
  skillReplicationPayload,
} from "../../../repositories/skills/index.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  replicateAcrossWorkspaces,
  sendReplicationResponse,
} from "../../../services/workspaceReplicationService.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { sendNotFound } from "../helpers.js";

export function registerCreateReplicate(router: Router) {
  router.post(
    "/:skillId/:version/replicate",
    requireAllPermissions("skills.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const source = (
        await getSkill(
          req.params.skillId,
          req.params.version,
          authorizationQuery(req.actor, "skills.read", req.query),
          { includeContents: true },
        )
      ).skill;
      if (!source) {
        return sendNotFound(res, req.params.skillId, req.params.version);
      }

      const batch = await replicateAcrossWorkspaces({
        actor: req.actor,
        forbiddenCode: "DESTINATION_SKILL_PUBLISH_FORBIDDEN",
        forbiddenMessage:
          "Você não possui permissão para publicar skills neste workspace",
        payload: req.body,
        permission: "skills.publish",
        resourceType: "skill",
        replicate: async ({ destinationActor, destinationWorkspaceId }) => {
          const result = await publishSkill(skillReplicationPayload(source), {
            ...authorizationQuery(destinationActor, "skills.publish"),
            forceRootCollection: true,
          });
          await recordAuditEvent({
            actor: destinationActor,
            action: "published",
            target: {
              type: "skill",
              id: result.skill.skillId,
              label: result.skill.name,
            },
            after: result.skill,
            summary: `Skill replicada: ${result.skill.skillId}@${result.skill.version}`,
            metadata: {
              workspaceId: destinationWorkspaceId,
              sourceWorkspaceId: source.workspaceId,
              sourceSkillId: source.skillId,
              sourceVersion: source.version,
            },
          });
          return {
            data: result,
            resource: {
              id: `${result.skill.skillId}@${result.skill.version}`,
              label: result.skill.name,
              type: "skill",
            },
            status: "created",
          };
        },
      });
      sendReplicationResponse(res, batch);
    }),
  );
}
