export function errorCode(value: unknown): unknown {
  return value !== null && typeof value === "object" && "code" in value
    ? value.code
    : undefined;
}
export function errorMessage(value: unknown): string {
  return value !== null &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : String(value);
}
export function errorStatusCode(value: unknown): number | undefined {
  return value !== null &&
    typeof value === "object" &&
    "statusCode" in value &&
    typeof value.statusCode === "number"
    ? value.statusCode
    : undefined;
}
