import { BiawsError } from "./errors.js";

export function scalarText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  )
    return String(value);
  throw new BiawsError("Expected a scalar text value");
}
