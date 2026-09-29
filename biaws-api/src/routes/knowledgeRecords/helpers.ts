import { textValue } from "../../helpers/text.js";
import type { Actor } from "../../types/http.js";
import type { Request, Response } from "express";
import {
  actorCanAccessApplication,
  actorHasPermission,
  actorHasWorkspaceScope,
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { documentTypeConfig, getDocument } from "../../repositories/documents/index.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export function authorize(operation: string) {
  return requireAllPermissions(`documents.${operation}`);
}

export function query(req: Request, operation: string, additions = {}) {
  return authorizationQuery(req.actor, `documents.${operation}`, {
    ...req.query,
    ...additions,
  });
}

export function actorId(req: Request) {
  return req.actor.email || req.actor.userId;
}

export function typeFor(req: Request, payload: { documentType?: unknown } = {}) {
  const documentType = textValue(payload.documentType || req.query.documentType || "");
  if (documentType) documentTypeConfig(documentType);
  return documentType;
}

export async function currentDocument(req: Request, operation = "read") {
  const result = await getDocument(req.params.id, query(req, operation));
  return result.document;
}

export function sendNotFound(res: Response) {
  res.status(404).json({
    error: { code: "DOCUMENT_NOT_FOUND", message: "Documento não encontrado" },
  });
}

export function replicationPermissionError(permission: string, message: string | undefined) {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = "DESTINATION_DOCUMENT_WRITE_FORBIDDEN";
  error.requiredPermissions = [permission];
  return error;
}

export function canUpdateReplicatedDocument(actor: Partial<Actor>, document: { applicationId: string | null }) {
  if (!actorHasPermission(actor, "documents.update")) return false;
  return document.applicationId
    ? actorCanAccessApplication(actor, "documents.update", document.applicationId)
    : actorHasWorkspaceScope(actor, "documents.update");
}

export const asyncHandler = createReferenceHandler("document");
