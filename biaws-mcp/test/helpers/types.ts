import { z } from "zod";
import { apiPayloadSchema } from "../../src/api/apiContracts.js";
import { errorInfo } from "../../src/runtime/errors.js";
export function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error("Missing test fixture value");
  return value;
}
export interface ApiCall {
  path: string;
  method: string;
  search?: string;
  body: Record<string, unknown>;
  headers?: Headers;
  url?: URL;
}
export interface LogEvent {
  event: string;
  fields: Record<string, unknown>;
}
export const toolPayload = (value: unknown) => apiPayloadSchema.parse(value);
export const fieldErrors = (value: unknown) =>
  z
    .array(
      z.object({ path: z.string(), code: z.string(), message: z.string() }),
    )
    .parse(errorInfo(value).fields);
export { errorInfo };

export function textContent(value: object): string {
  if (!("text" in value) || typeof value.text !== "string")
    throw new Error("Expected text content");
  return value.text;
}
export function blobContent(value: object): string {
  if (!("blob" in value) || typeof value.blob !== "string")
    throw new Error("Expected blob content");
  return value.blob;
}
export function recordEvents(events: LogEvent[]) {
  const write = (event: string, fields: Record<string, unknown> = {}) => {
    events.push({ event, fields });
    return true;
  };
  return { debug: write, info: write, warn: write, error: write };
}
