import type { RepositoryQuery } from "../../types/http.js";
export function createHttpError(statusCode: number | undefined, message: string | undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function workspaceId(query: RepositoryQuery = {}) {
  return String(query.authorizationScope?.workspaceId || query.workspaceId || "");
}
