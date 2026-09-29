import multer from "multer";
import { getServerConfig } from "../../config.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export const uploadSecretFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getServerConfig().secrets.maxFileBytes, files: 1 },
});

export function auditTarget(secret) {
  return { type: "secret", id: secret.id, label: secret.name };
}

export function auditMetadata(secret) {
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

export const asyncHandler = createReferenceHandler(undefined);
