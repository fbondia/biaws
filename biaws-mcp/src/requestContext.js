import { AsyncLocalStorage } from "node:async_hooks";

const requestContext = new AsyncLocalStorage();

export function runWithRequestContext(context, callback) {
  return requestContext.run(context, callback);
}

export function currentRequestSignal() {
  return requestContext.getStore()?.signal;
}

export function currentRequestContext() {
  return requestContext.getStore();
}
