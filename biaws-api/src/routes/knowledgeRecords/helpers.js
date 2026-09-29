import {
  actorCanAccessApplication,
  actorHasPermission,
  actorHasWorkspaceScope,
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import {
  documentTypeConfig,
  getDocument,
} from "../../repositories/documents/index.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export function authorize(operation) {
  return requireAllPermissions(`documents.${operation}`);
}

export function query(req, operation, additions = {}) {
  return authorizationQuery(req.actor, `documents.${operation}`, {
    ...req.query,
    ...additions,
  });
}

export function actorId(req) {
  return req.actor.email || req.actor.userId;
}

export function typeFor(req, payload = {}) {
  const documentType = payload.documentType || req.query.documentType;
  if (documentType) documentTypeConfig(documentType);
  return documentType;
}

export async function currentDocument(req, operation = "read") {
  const result = await getDocument(req.params.id, query(req, operation));
  return result.document;
}

export function sendNotFound(res) {
  res.status(404).json({
    error: { code: "DOCUMENT_NOT_FOUND", message: "Documento não encontrado" },
  });
}

export function replicationPermissionError(permission, message) {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = "DESTINATION_DOCUMENT_WRITE_FORBIDDEN";
  error.requiredPermissions = [permission];
  return error;
}

export function canUpdateReplicatedDocument(actor, document) {
  if (!actorHasPermission(actor, "documents.update")) return false;
  return document.applicationId
    ? actorCanAccessApplication(
        actor,
        "documents.update",
        document.applicationId,
      )
    : actorHasWorkspaceScope(actor, "documents.update");
}

export const asyncHandler = createReferenceHandler("document");
