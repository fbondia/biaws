import { ObjectId } from "mongodb";

// Preserve scalar, date and Mongo ID representations; never persist the
// default JavaScript object label as a user-provided identifier or text.
export function textValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || typeof value === "symbol")
    return String(value);
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toString();
  if (Array.isArray(value)) return value.map((item) => (item == null ? "" : textValue(item))).join(",");
  const error = new Error("Expected a scalar text value");
  error.statusCode = 422;
  error.code = "INVALID_TEXT_VALUE";
  throw error;
}
