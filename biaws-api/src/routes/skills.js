import { Router } from "express";

import {
  deprecateSkill,
  getSkill,
  listSkills,
  moveSkillToCollection,
  publishSkill,
  skillReplicationPayload,
} from "../repositories/skillsRepository.js";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import {
  replicateAcrossWorkspaces,
  sendReplicationResponse,
} from "../services/workspaceReplicationService.js";
import { assertResourceCollection } from "../repositories/resourceCollectionsRepository.js";

export const skillsRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function sendNotFound(res, skillId, version) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Skill not found: ${skillId}${version ? `@${version}` : ""}`,
    },
  });
}

skillsRouter.get(
  "/",
  requireAllPermissions("skills.read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listSkills(authorizationQuery(req.actor, "skills.read", req.query)),
    );
  }),
);

skillsRouter.patch(
  "/:skillId/collection",
  requireAllPermissions("skills.publish"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(req.actor, "skills.publish", req.query);
    const before = (await getSkill(req.params.skillId, undefined, query)).skill;
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

skillsRouter.post(
  "/",
  requireAllPermissions("skills.publish"),
  asyncHandler(async (req, res) => {
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

skillsRouter.get(
  "/:skillId",
  requireAllPermissions("skills.read"),
  asyncHandler(async (req, res) => {
    const result = await getSkill(
      req.params.skillId,
      req.query.version,
      authorizationQuery(req.actor, "skills.read", req.query),
    );
    if (!result.skill)
      return sendNotFound(res, req.params.skillId, req.query.version);
    res.json(result);
  }),
);

skillsRouter.get(
  "/:skillId/:version/download",
  requireAllPermissions("skills.read"),
  asyncHandler(async (req, res) => {
    const result = await getSkill(
      req.params.skillId,
      req.params.version,
      authorizationQuery(req.actor, "skills.read", req.query),
      {
        includeContents: true,
      },
    );
    if (!result.skill)
      return sendNotFound(res, req.params.skillId, req.params.version);
    res.setHeader("Content-Type", "application/vnd.biaws.skill+json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.skill.skillId}-${result.skill.version}.skill.json"`,
    );
    res.json({
      format: "biaws-skill-package/v1",
      skill: result.skill,
    });
  }),
);

skillsRouter.post(
  "/:skillId/:version/replicate",
  requireAllPermissions("skills.read"),
  asyncHandler(async (req, res) => {
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

skillsRouter.patch(
  "/:skillId/:version/deprecate",
  requireAllPermissions("skills.deprecate"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(req.actor, "skills.deprecate", req.query);
    const before = (
      await getSkill(req.params.skillId, req.params.version, query)
    ).skill;
    const result = await deprecateSkill(
      req.params.skillId,
      req.params.version,
      query,
    );
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
