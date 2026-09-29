export class BiawsError extends Error {
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  requestId?: string;
  requiredPermissions?: unknown;
  fields?: unknown;
  details?: unknown;
}
export function errorInfo(value: unknown): BiawsError {
  const error = value instanceof Error ? value : new Error(String(value));
  const source = isRecord(value) ? value : {};
  const result = new BiawsError(error.message, { cause: error.cause });
  result.name = error.name;
  result.stack = error.stack;
  for (const key of ["code", "requestId"] as const) {
    if (key in source && typeof source[key] === "string") result[key] = source[key];
  }
  if ("statusCode" in source && typeof source.statusCode === "number") result.statusCode = source.statusCode;
  if ("retryable" in source && typeof source.retryable === "boolean") result.retryable = source.retryable;
  for (const key of ["requiredPermissions", "fields", "details"] as const) {
    if (key in source) result[key] = source[key];
  }
  return result;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
