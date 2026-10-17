import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "./logger.js";
import { BiawsError } from "./errors.js";
export interface ApiIdentity {
  readonly token: string;
  readonly workspaceId: string;
}
export interface RequestContext {
  transport?: "stdio" | "http";
  authentication?: ApiIdentity;
  signal?: AbortSignal;
  logger?: Logger;
  requestId?: string;
  tool?: string;
}
const requestContext = new AsyncLocalStorage<RequestContext>();
export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  const inherited = { ...requestContext.getStore(), ...context };
  if (inherited.authentication) inherited.authentication = Object.freeze({ ...inherited.authentication });
  return requestContext.run(inherited, callback);
}
export function currentRequestSignal() {
  return requestContext.getStore()?.signal;
}
export function currentRequestContext() {
  return requestContext.getStore();
}
export function currentApiIdentity(): ApiIdentity {
  const context = requestContext.getStore();
  if (context?.transport === "http") {
    const identity = context.authentication;
    if (!identity?.token || !identity.workspaceId)
      throw Object.assign(new BiawsError("Authenticated HTTP request context is required"), {
        code: "MCP_HTTP_UNAUTHENTICATED",
        statusCode: 401,
      });
    return identity;
  }
  return (
    context?.authentication ?? {
      token: String(process.env.BIAWS_API_KEY || "").trim(),
      workspaceId: String(process.env.BIAWS_WORKSPACE_ID || "").trim(),
    }
  );
}
