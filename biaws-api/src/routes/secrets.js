import { Router } from "express";
import multer from "multer";

import { requireAllPermissions } from "../auth/authorizationMiddleware.js";
import { getServerConfig } from "../config.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import {
  archiveSecret,
  createFileSecret,
  createSecret,
  downloadSecretFile,
  getAccessibleSecret,
  listAccessibleSecrets,
  moveSecretToCollection,
  registerSecretMetadata,
  revealSecret,
  updateSecret,
  writeSecretFile,
  writeSecretValue,
} from "../services/secretsService.js";

export const secretsRouter = Router();
const uploadSecretFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getServerConfig().secrets.maxFileBytes, files: 1 },
});

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
    contentKind: secret.contentKind,
    fileName: secret.file?.name,
    fileSize: secret.file?.size,
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
  "/registrations",
  requireAllPermissions("secrets.metadata.create"),
  asyncHandler(async (req, res) => {
    const secret = await registerSecretMetadata(req.body, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "registered",
      target: auditTarget(secret),
      after: secret,
      metadata: auditMetadata(secret),
      summary: `Necessidade de segredo registrada: ${secret.name}`,
    });
    res.status(201).json({ secret });
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

secretsRouter.post(
  "/files",
  requireAllPermissions("secrets.create", "secrets.value.write"),
  uploadSecretFile.single("file"),
  asyncHandler(async (req, res) => {
    const secret = await createFileSecret(req.body, req.file, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: auditTarget(secret),
      after: secret,
      metadata: auditMetadata(secret),
      summary: `Arquivo secreto criado: ${secret.name}`,
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
  "/:secretId/collection",
  requireAllPermissions("secrets.metadata.read", "secrets.update"),
  asyncHandler(async (req, res) => {
    const before = await getAccessibleSecret(req.params.secretId, req.actor);
    const secret = await moveSecretToCollection(
      req.params.secretId,
      req.body?.collectionId,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: auditTarget(secret),
      before,
      after: secret,
      metadata: auditMetadata(secret),
      summary: `Segredo movido entre coleções: ${secret.name}`,
    });
    res.json({ secret });
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

secretsRouter.put(
  "/:secretId/file",
  requireAllPermissions("secrets.value.write"),
  uploadSecretFile.single("file"),
  asyncHandler(async (req, res) => {
    const secret = await writeSecretFile(
      req.params.secretId,
      req.file,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "version.created",
      target: auditTarget(secret),
      metadata: auditMetadata(secret),
      summary: `Nova versão de arquivo gravada para o segredo: ${secret.name}`,
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
  "/:secretId/copy",
  requireAllPermissions("secrets.value.reveal"),
  asyncHandler(async (req, res) => {
    const copied = await revealSecret(req.params.secretId, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "copied",
      target: auditTarget(copied.secret),
      metadata: auditMetadata(copied.secret),
      summary: `Valor do segredo copiado: ${copied.secret.name}`,
    });
    res.set({
      "Cache-Control": "no-store, private",
      Pragma: "no-cache",
    });
    res.json({ value: copied.value, version: copied.version });
  }),
);

secretsRouter.post(
  "/:secretId/download",
  requireAllPermissions("secrets.value.reveal"),
  asyncHandler(async (req, res) => {
    const downloaded = await downloadSecretFile(req.params.secretId, req.actor);
    await recordAuditEvent({
      actor: req.actor,
      action: "revealed",
      target: auditTarget(downloaded.secret),
      metadata: auditMetadata(downloaded.secret),
      summary: `Arquivo secreto baixado: ${downloaded.secret.name}`,
    });
    const fallbackName = downloaded.fileName.replace(/[\r\n"]/gu, "_");
    const encodedName = encodeURIComponent(downloaded.fileName);
    res.set({
      "Cache-Control": "no-store, private",
      Pragma: "no-cache",
      "Content-Type": downloaded.mediaType,
      "Content-Length": String(downloaded.content.length),
      "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
      "X-Content-Type-Options": "nosniff",
    });
    res.send(downloaded.content);
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
