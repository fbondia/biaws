import type { RepositoryQuery } from "../../types/http.js";
import { errorCode } from "../../helpers/error.js";
export function httpError(
  statusCode: number | undefined,
  code: string | number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function workspaceId(query: RepositoryQuery = {}) {
  return String(query.authorizationScope?.workspaceId || query.workspaceId || "");
}

export function duplicateError(error: unknown) {
  if (errorCode(error) === 11000) {
    throw httpError(409, "COLLECTION_NAME_CONFLICT", "Já existe uma coleção com este nome no local selecionado");
  }
  throw error;
}
