import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "../../../src/api/httpClient.js";
import { runWithRequestContext } from "../../../src/runtime/requestContext.js";
import { errorInfo, required } from "../../helpers/types.js";
test("MCP HTTP client times out stalled responses", async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = process.env.BIAWS_MCP_HTTP_TIMEOUT_MS;
  process.env.BIAWS_MCP_HTTP_TIMEOUT_MS = "20";
  globalThis.fetch = async (url, options) =>
    new Promise((_, reject) => {
      // AbortSignal.timeout uses an unreferenced timer in Node 22. A real
      // pending request keeps the event loop alive, so the stub must too.
      const pendingRequest = setTimeout(
        () => reject(new Error("Expected the stalled request to be aborted")),
        1_000,
      );
      required(options?.signal).addEventListener(
        "abort",
        () => {
          clearTimeout(pendingRequest);
          reject(required(options?.signal).reason);
        },
        { once: true },
      );
    });
  try {
    await assert.rejects(
      () => fetchJson("/api/issues"),
      (error) =>
        errorInfo(error).code === "UPSTREAM_TIMEOUT" &&
        errorInfo(error).statusCode === 504 &&
        errorInfo(error).retryable === true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalTimeout === undefined)
      delete process.env.BIAWS_MCP_HTTP_TIMEOUT_MS;
    else process.env.BIAWS_MCP_HTTP_TIMEOUT_MS = originalTimeout;
  }
});

test("MCP HTTP client distinguishes caller cancellation from timeout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) =>
    new Promise((resolve, reject) => {
      required(options?.signal).addEventListener(
        "abort",
        () => reject(required(options?.signal).reason),
        {
          once: true,
        },
      );
    });
  const controller = new AbortController();
  try {
    const request = runWithRequestContext({ signal: controller.signal }, () =>
      fetchJson("/api/issues"),
    );
    controller.abort();
    await assert.rejects(
      () => request,
      (error) =>
        errorInfo(error).code === "REQUEST_CANCELLED" &&
        errorInfo(error).statusCode === 499 &&
        errorInfo(error).retryable === false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
