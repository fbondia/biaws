import { currentRequestSignal } from "./requestContext.js";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_RETRIES = 2;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function readBaseUrl() {
  const explicit =
    process.env.ISSUE_API_URL ||
    process.env.ISSUE_API_BASE_URL ||
    process.env.VITE_ISSUE_API_URL;
  if (explicit) return explicit.replace(/\/$/u, "");

  const host = process.env.ISSUE_API_HOST || process.env.HOST || "127.0.0.1";
  const port = process.env.ISSUE_API_PORT || process.env.PORT || "3100";
  return `http://${host}:${port}`;
}

function readTimeoutMs() {
  const configured = Number(process.env.BIAWS_MCP_HTTP_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
}

function readMaxRetries() {
  const configured = Number(process.env.BIAWS_MCP_HTTP_RETRIES);
  return Number.isInteger(configured) && configured >= 0
    ? Math.min(configured, MAX_RETRIES)
    : DEFAULT_RETRIES;
}

function buildUrl(path, params = {}) {
  // The MCP entrypoint loads .env after its static ESM imports are evaluated.
  // Resolve the base URL lazily so the loaded environment is honored.
  const url = new URL(path, readBaseUrl());

  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url;
}

function authenticationHeaders() {
  const apiKey = String(process.env.ISSUE_API_KEY || "").trim();
  const workspaceId = String(process.env.ISSUE_WORKSPACE_ID || "").trim();
  return {
    Accept: "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(workspaceId ? { "X-Biaws-Workspace-Id": workspaceId } : {}),
  };
}

function copyPublicErrorDetails(error, apiError = {}) {
  for (const field of [
    "requiredPermissions",
    "fields",
    "details",
    "retryable",
  ]) {
    if (apiError[field] !== undefined) error[field] = apiError[field];
  }
}

function responseError(response, payload) {
  const apiError = payload?.error || {};
  const error = new Error(
    apiError.message || payload?.message || `HTTP ${response.status}`,
  );
  error.statusCode = response.status;
  error.code =
    apiError.code ||
    {
      400: "BAD_REQUEST",
      401: "UNAUTHENTICATED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
    }[response.status] ||
    "ISSUE_API_ERROR";
  error.requestId =
    apiError.requestId || response.headers.get("x-request-id") || undefined;
  error.retryable =
    typeof apiError.retryable === "boolean"
      ? apiError.retryable
      : RETRYABLE_STATUSES.has(response.status);
  copyPublicErrorDetails(error, apiError);
  return error;
}

function transportError(error, url, externalSignal) {
  if (externalSignal?.aborted) {
    const cancelled = new Error("The MCP request was cancelled");
    cancelled.code = "REQUEST_CANCELLED";
    cancelled.statusCode = 499;
    cancelled.retryable = false;
    return cancelled;
  }
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    const timeout = new Error(
      `biaws-api did not respond within ${readTimeoutMs()}ms`,
    );
    timeout.code = "UPSTREAM_TIMEOUT";
    timeout.statusCode = 504;
    timeout.retryable = true;
    return timeout;
  }
  const unavailable = new Error(
    `Failed to reach biaws-api at ${url.origin}: ${error.message}`,
    { cause: error },
  );
  unavailable.code = "UPSTREAM_UNAVAILABLE";
  unavailable.statusCode = 503;
  unavailable.retryable = true;
  return unavailable;
}

async function readPayload(response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function attachmentSizeError(maxBytes, actualBytes) {
  const error = new Error(
    `Attachment exceeds the MCP limit of ${maxBytes} bytes`,
  );
  error.code = "ATTACHMENT_TOO_LARGE";
  error.statusCode = 413;
  error.retryable = false;
  error.details = {
    maxBytes,
    ...(Number.isFinite(actualBytes) ? { actualBytes } : {}),
  };
  return error;
}

async function requestJson(
  path,
  { method, body, params = {}, headers = {} } = {},
) {
  const url = buildUrl(path, params);
  const externalSignal = currentRequestSignal();
  const timeoutSignal = AbortSignal.timeout(readTimeoutMs());
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;
  const maxRetries = !method || method === "GET" ? readMaxRetries() : 0;

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...(method ? { method } : {}),
        headers: { ...authenticationHeaders(), ...headers },
        body,
        signal,
      });
      const payload = await readPayload(response);
      if (!response.ok) throw responseError(response, payload);
      return payload;
    } catch (cause) {
      const error = cause?.statusCode
        ? cause
        : transportError(cause, url, externalSignal);
      if (attempt >= maxRetries || error.retryable !== true || signal.aborted) {
        throw error;
      }
      try {
        await delay(100 * 2 ** attempt, undefined, { signal });
      } catch (delayError) {
        throw transportError(delayError, url, externalSignal);
      }
    }
  }
}

async function requestBinary(
  path,
  { params = {}, headers = {}, maxBytes } = {},
) {
  const url = buildUrl(path, params);
  const externalSignal = currentRequestSignal();
  const timeoutSignal = AbortSignal.timeout(readTimeoutMs());
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;
  const maxRetries = readMaxRetries();

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { ...authenticationHeaders(), ...headers },
        signal,
      });
      if (!response.ok) {
        throw responseError(response, await readPayload(response));
      }

      const declaredBytes = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(maxBytes) &&
        maxBytes > 0 &&
        Number.isFinite(declaredBytes) &&
        declaredBytes > maxBytes
      ) {
        await response.body?.cancel();
        throw attachmentSizeError(maxBytes, declaredBytes);
      }

      const content = Buffer.from(await response.arrayBuffer());
      if (
        Number.isFinite(maxBytes) &&
        maxBytes > 0 &&
        content.length > maxBytes
      ) {
        throw attachmentSizeError(maxBytes, content.length);
      }
      return { content, headers: response.headers };
    } catch (cause) {
      const error = cause?.statusCode
        ? cause
        : transportError(cause, url, externalSignal);
      if (attempt >= maxRetries || error.retryable !== true || signal.aborted) {
        throw error;
      }
      try {
        await delay(100 * 2 ** attempt, undefined, { signal });
      } catch (delayError) {
        throw transportError(delayError, url, externalSignal);
      }
    }
  }
}

export function cleanParams(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== null && entry !== "",
    ),
  );
}

export function fetchJson(path, params = {}) {
  return requestJson(path, { params });
}

export function fetchBinary(path, params = {}, options = {}) {
  return requestBinary(path, { params, maxBytes: options.maxBytes });
}

export function sendJson(path, body = {}, params = {}, method = "PUT") {
  return requestJson(path, {
    method,
    params,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteJson(path, params = {}) {
  return requestJson(path, { method: "DELETE", params });
}

export function sendMultipart(path, form, params = {}) {
  return requestJson(path, { method: "POST", params, body: form });
}
