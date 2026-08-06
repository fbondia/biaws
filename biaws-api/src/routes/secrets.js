import { Router } from "express";

import { requireAllPermissions } from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import {
  archiveSecret,
  createSecret,
  getAccessibleSecret,
  listAccessibleSecrets,
  revealSecret,
  updateSecret,
  writeSecretValue,
} from "../services/secretsService.js";

export const secretsRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function auditTarget(secret) {
  return { type: "secret", id: secret.id, label: secret.name };
}

function auditMetadata(secret) {
  return {
    workspaceId: secret.workspaceId,
    applicationId: secret.applicationId || undefined,
    environment: secret.environment || undefined,
    version: secret.currentVersion,
  };
}

secretsRouter.get(
  "/",
  requireAllPermissions("secrets.metadata.read"),
  asyncHandler(async (req, res) => {
    res.json(await listAccessibleSecrets(req.query, req.actor));
  }),
);

secretsRouter.post(
  "/",
  requireAllPermissions("secrets.create", "secrets.value.write"),
  asyncHandler(async (req, res) => {
    const secret = await createSecret(req.body, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: auditTarget(secret),
      after: secret,
      metadata: auditMetadata(secret),
      summary: `Segredo criado: ${secret.name}`,
    });
    res.status(201).json({ secret });
  }),
);

secretsRouter.get(
  "/:secretId",
  requireAllPermissions("secrets.metadata.read"),
  asyncHandler(async (req, res) => {
    res.json({
      secret: await getAccessibleSecret(req.params.secretId, req.actor),
    });
  }),
);

secretsRouter.patch(
  "/:secretId",
  requireAllPermissions("secrets.metadata.read", "secrets.update"),
  asyncHandler(async (req, res) => {
    const before = await getAccessibleSecret(req.params.secretId, req.actor);
    const secret = await updateSecret(req.params.secretId, req.body, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: auditTarget(secret),
      before,
      after: secret,
      metadata: auditMetadata(secret),
      summary: `Segredo alterado: ${secret.name}`,
    });
    res.json({ secret });
  }),
);

secretsRouter.put(
  "/:secretId/value",
  requireAllPermissions("secrets.value.write"),
  asyncHandler(async (req, res) => {
    const secret = await writeSecretValue(
      req.params.secretId,
      req.body?.value,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "version.created",
      target: auditTarget(secret),
      metadata: auditMetadata(secret),
      summary: `Nova versão gravada para o segredo: ${secret.name}`,
    });
    res.json({ secret });
  }),
);

secretsRouter.post(
  "/:secretId/reveal",
  requireAllPermissions("secrets.value.reveal"),
  asyncHandler(async (req, res) => {
    const revealed = await revealSecret(req.params.secretId, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "revealed",
      target: auditTarget(revealed.secret),
      metadata: auditMetadata(revealed.secret),
      summary: `Segredo revelado: ${revealed.secret.name}`,
    });
    res.set({
      "Cache-Control": "no-store, private",
      Pragma: "no-cache",
    });
    res.json({ value: revealed.value, version: revealed.version });
  }),
);

secretsRouter.post(
  "/:secretId/archive",
  requireAllPermissions("secrets.metadata.read", "secrets.archive"),
  asyncHandler(async (req, res) => {
    const before = await getAccessibleSecret(req.params.secretId, req.actor);
    const secret = await archiveSecret(req.params.secretId, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "archived",
      target: auditTarget(secret),
      before,
      after: secret,
      metadata: auditMetadata(secret),
      summary: `Segredo arquivado: ${secret.name}`,
    });
    res.json({ secret });
  }),
);
