import type { Actor } from "../../types/http.js";
export function homeError(
  statusCode: number | undefined,
  code: string | number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function hasPermission(actor: Partial<Actor>, permission: string) {
  return actor?.permissions?.includes(permission) === true;
}
