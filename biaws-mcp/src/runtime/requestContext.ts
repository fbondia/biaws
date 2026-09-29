import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "./logger.js";
export interface RequestContext {
  signal?: AbortSignal;
  logger?: Logger;
  requestId?: string;
  tool?: string;
}
const requestContext = new AsyncLocalStorage<RequestContext>();
export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}
export function currentRequestSignal() {
  return requestContext.getStore()?.signal;
}
export function currentRequestContext() {
  return requestContext.getStore();
}
