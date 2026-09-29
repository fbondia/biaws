import { scalarText } from "../runtime/text.js";
import { setTimeout as delay } from "node:timers/promises";
import { parseApiPayload, type ApiPayload } from "./apiContracts.js";
import { BiawsError, errorInfo } from "../runtime/errors.js";
import type { Logger } from "../runtime/logger.js";
import { currentRequestContext, currentRequestSignal } from "../runtime/requestContext.js";
interface HttpContext {
  url: URL;
  signal: AbortSignal;
  externalSignal?: AbortSignal;
  maxRetries: number;
  method: string;
  logger?: Logger;
  requestId?: string;
  tool?: string;
  responseStatus?: number;
}
interface HttpOptions {
  method?: string;
  body?: BodyInit;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  maxBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_RETRIES = 2;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function readBaseUrl() {
  const explicit = process.env.BIAWS_API_URL || process.env.BIAWS_API_BASE_URL || process.env.VITE_BIAWS_API_URL;
  if (explicit) return explicit.replace(/\/$/u, "");

  const host = process.env.BIAWS_API_HOST || process.env.HOST || "127.0.0.1";
  const port = process.env.BIAWS_API_PORT || process.env.PORT || "3100";
  return `http://${host}:${port}`;
}

function readTimeoutMs() {
  const configured = Number(process.env.BIAWS_MCP_HTTP_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
}

function readMaxRetries() {
  const configured = Number(process.env.BIAWS_MCP_HTTP_RETRIES);
  return Number.isInteger(configured) && configured >= 0 ? Math.min(configured, MAX_RETRIES) : DEFAULT_RETRIES;
}

function buildUrl(path: string, params: Record<string, unknown> = {}) {
  // The MCP entrypoint loads .env after its static ESM imports are evaluated.
  // Resolve the base URL lazily so the loaded environment is honored.
  const url = new URL(path, readBaseUrl());

  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, scalarText(value));
  }

  return url;
}

function authenticationHeaders() {
  const apiKey = String(process.env.BIAWS_API_KEY || "").trim();
  const workspaceId = String(process.env.BIAWS_WORKSPACE_ID || "").trim();
  return {
    Accept: "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(workspaceId ? { "X-Biaws-Workspace-Id": workspaceId } : {}),
  };
}

function copyPublicErrorDetails(error: BiawsError, apiError: Record<string, unknown> = {}) {
  for (const field of ["requiredPermissions", "fields", "details", "retryable"] as const) {
    if (field === "retryable") {
      if (typeof apiError[field] === "boolean") error.retryable = apiError[field];
    } else if (apiError[field] !== undefined) error[field] = apiError[field];
  }
}

function responseError(response: Response, payload: ApiPayload) {
  const apiError = payload?.error || {};
  const error = new BiawsError(apiError.message || payload?.message || `HTTP ${response.status}`);
  error.statusCode = response.status;
  error.code =
    apiError.code ||
    (
      {
        400: "BAD_REQUEST",
        401: "UNAUTHENTICATED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "UNPROCESSABLE_ENTITY",
      } as Record<number, string>
    )[response.status] ||
    "ISSUE_API_ERROR";
  error.requestId = apiError.requestId || response.headers.get("x-request-id") || undefined;
  error.retryable =
    typeof apiError.retryable === "boolean" ? apiError.retryable : RETRYABLE_STATUSES.has(response.status);
  copyPublicErrorDetails(error, apiError);
  return error;
}

function transportError(value: unknown, url: URL, externalSignal?: AbortSignal) {
  const error = errorInfo(value);
  if (externalSignal?.aborted) {
    const cancelled = new BiawsError("The MCP request was cancelled");
    cancelled.code = "REQUEST_CANCELLED";
    cancelled.statusCode = 499;
    cancelled.retryable = false;
    return cancelled;
  }
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    const timeout = new BiawsError(`biaws-api did not respond within ${readTimeoutMs()}ms`);
    timeout.code = "UPSTREAM_TIMEOUT";
    timeout.statusCode = 504;
    timeout.retryable = true;
    return timeout;
  }
  const unavailable = new BiawsError(`Failed to reach biaws-api at ${url.origin}: ${error.message}`, { cause: error });
  unavailable.code = "UPSTREAM_UNAVAILABLE";
  unavailable.statusCode = 503;
  unavailable.retryable = true;
  return unavailable;
}

async function readPayload(response: Response): Promise<ApiPayload> {
  const text = await response.text();
  if (!text.trim()) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {};
  }
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string")
    value = { ...value, error: { message: value.error } };
  return parseApiPayload(value);
}

function attachmentSizeError(maxBytes: number, actualBytes?: number) {
  const error = new BiawsError(`Attachment exceeds the MCP limit of ${maxBytes} bytes`);
  error.code = "ATTACHMENT_TOO_LARGE";
  error.statusCode = 413;
  error.retryable = false;
  error.details = {
    maxBytes,
    ...(Number.isFinite(actualBytes) ? { actualBytes } : {}),
  };
  return error;
}

function createRequestContext(
  path: string,
  params: Record<string, unknown>,
  maxRetries: number,
  method?: string,
): HttpContext {
  const url = buildUrl(path, params);
  const externalSignal = currentRequestSignal();
  const mcpContext = currentRequestContext();
  const timeoutSignal = AbortSignal.timeout(readTimeoutMs());
  return {
    url,
    externalSignal,
    signal: externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal,
    maxRetries,
    method: method || "GET",
    logger: mcpContext?.logger,
    requestId: mcpContext?.requestId,
    tool: mcpContext?.tool,
  };
}

function normalizeRequestError(value: unknown, context: HttpContext) {
  const cause = errorInfo(value);
  return cause?.statusCode ? cause : transportError(cause, context.url, context.externalSignal);
}

function shouldRetryRequest(error: BiawsError, attempt: number, context: HttpContext) {
  return attempt < context.maxRetries && error.retryable === true && !context.signal.aborted;
}

async function waitBeforeRetry(attempt: number, context: HttpContext) {
  const backoffMs = 100 * 2 ** attempt;
  context.logger?.warn("mcp_http_retry_scheduled", {
    requestId: context.requestId,
    tool: context.tool,
    method: context.method,
    origin: context.url.origin,
    nextAttempt: attempt + 2,
    backoffMs,
  });
  try {
    await delay(backoffMs, undefined, { signal: context.signal });
  } catch (error_) {
    const error = errorInfo(error_);
    throw transportError(error, context.url, context.externalSignal);
  }
}

async function requestWithRetries<T>(
  context: HttpContext,
  operation: (context: HttpContext) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now();
    context.logger?.debug("mcp_http_attempt_started", {
      requestId: context.requestId,
      tool: context.tool,
      method: context.method,
      origin: context.url.origin,
      attempt: attempt + 1,
    });
    try {
      const result = await operation(context);
      context.logger?.info("mcp_http_attempt_completed", {
        requestId: context.requestId,
        tool: context.tool,
        method: context.method,
        origin: context.url.origin,
        attempt: attempt + 1,
        durationMs: Math.max(0, Date.now() - startedAt),
        statusCode: context.responseStatus,
      });
      return result;
    } catch (error_) {
      const cause = errorInfo(error_);
      const error = normalizeRequestError(cause, context);
      const retry = shouldRetryRequest(error, attempt, context);
      context.logger?.[retry ? "warn" : "error"]("mcp_http_attempt_failed", {
        requestId: context.requestId,
        tool: context.tool,
        method: context.method,
        origin: context.url.origin,
        attempt: attempt + 1,
        durationMs: Math.max(0, Date.now() - startedAt),
        willRetry: retry,
        error,
      });
      if (!retry) throw error;
      await waitBeforeRetry(attempt, context);
    }
  }
}

function validAttachmentLimit(maxBytes: number | undefined): maxBytes is number {
  return typeof maxBytes === "number" && Number.isFinite(maxBytes) && maxBytes > 0;
}

async function validateDeclaredAttachmentSize(response: Response, maxBytes?: number) {
  const declaredBytes = Number(response.headers.get("content-length"));
  if (!validAttachmentLimit(maxBytes) || !Number.isFinite(declaredBytes)) return;
  if (declaredBytes <= maxBytes) return;
  await response.body?.cancel();
  throw attachmentSizeError(maxBytes, declaredBytes);
}

function validateAttachmentSize(content: Buffer, maxBytes?: number) {
  if (validAttachmentLimit(maxBytes) && content.length > maxBytes) {
    throw attachmentSizeError(maxBytes, content.length);
  }
}

async function requestJson(path: string, { method, body, params = {}, headers = {} }: HttpOptions = {}) {
  const maxRetries = !method || method === "GET" ? readMaxRetries() : 0;
  const context = createRequestContext(path, params, maxRetries, method);
  return requestWithRetries(context, async (requestContext) => {
    const { url, signal } = requestContext;
    const response = await fetch(url, {
      ...(method ? { method } : {}),
      headers: { ...authenticationHeaders(), ...headers },
      body,
      signal,
    });
    requestContext.responseStatus = response.status;
    const payload = await readPayload(response);
    if (!response.ok) throw responseError(response, payload);
    return payload;
  });
}

async function requestBinary(path: string, { params = {}, headers = {}, maxBytes }: HttpOptions = {}) {
  const context = createRequestContext(path, params, readMaxRetries(), "GET");
  return requestWithRetries(context, async (requestContext) => {
    const { url, signal } = requestContext;
    const response = await fetch(url, {
      headers: { ...authenticationHeaders(), ...headers },
      signal,
    });
    requestContext.responseStatus = response.status;
    if (!response.ok) {
      throw responseError(response, await readPayload(response));
    }

    await validateDeclaredAttachmentSize(response, maxBytes);
    const content = Buffer.from(await response.arrayBuffer());
    validateAttachmentSize(content, maxBytes);
    return { content, headers: response.headers };
  });
}

export function cleanParams(value: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  );
}

export function fetchJson(path: string, params: Record<string, unknown> = {}) {
  return requestJson(path, { params });
}

export function fetchBinary(path: string, params: Record<string, unknown> = {}, options: { maxBytes?: number } = {}) {
  return requestBinary(path, { params, maxBytes: options.maxBytes });
}

export function sendJson(path: string, body: unknown = {}, params: Record<string, unknown> = {}, method = "PUT") {
  return requestJson(path, {
    method,
    params,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteJson(path: string, params: Record<string, unknown> = {}) {
  return requestJson(path, { method: "DELETE", params });
}

export function sendMultipart(path: string, form: FormData, params: Record<string, unknown> = {}) {
  return requestJson(path, { method: "POST", params, body: form });
}
