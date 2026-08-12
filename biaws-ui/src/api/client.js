import { defaultMessagesService } from "../infrastructure/messages/runtime.js";
import { defaultLogger } from "../infrastructure/logging/runtime.js";

const API_BASE_URL = (import.meta.env?.VITE_ISSUE_API_URL || "").replace(
  /\/$/u,
  "",
);
const EMPTY_SESSION_CONTEXT = Object.freeze({
  getWorkspaceId: () => "",
  onUnauthorized: () => {},
});

let sessionContext = EMPTY_SESSION_CONTEXT;
let requestSequence = 0;
const SESSION_OWNED_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/sign-in/email",
  "/api/auth/sign-out",
]);

function nextRequestId() {
  requestSequence += 1;
  return `ui-api-${Date.now()}-${requestSequence}`;
}

export function reportApiFailure({
  durationMs,
  error,
  logger = defaultLogger,
  method,
  path,
  requestId,
}) {
  const statusCode = Number(error?.statusCode) || undefined;
  const logicalPath = String(path || "").split("?")[0];
  if (statusCode === 401 || SESSION_OWNED_PATHS.has(logicalPath)) return;

  const details = {
    context: {
      durationMs,
      method,
      path: logicalPath,
      requestId,
      statusCode,
    },
    error,
  };
  try {
    if (statusCode === 403) {
      logger.warn("api.request.denied", {
        ...details,
        message: "An API request was denied",
      });
    } else if ([408, 429].includes(statusCode)) {
      logger.warn("api.request.rejected", {
        ...details,
        message: "An API request returned a recoverable rejection",
      });
    } else if (!statusCode || statusCode >= 500) {
      logger.error("api.request.failed", {
        ...details,
        message: "An API request failed unexpectedly",
      });
    }
  } catch {
    // Diagnostics must not replace the original API failure.
  }
}

export function configureApiSession({
  getWorkspaceId = EMPTY_SESSION_CONTEXT.getWorkspaceId,
  onUnauthorized = EMPTY_SESSION_CONTEXT.onUnauthorized,
} = {}) {
  const configuredContext = Object.freeze({ getWorkspaceId, onUnauthorized });
  sessionContext = configuredContext;

  return () => {
    if (sessionContext === configuredContext) {
      sessionContext = EMPTY_SESSION_CONTEXT;
    }
  };
}

export function workspaceHeaders(
  headers = {},
  workspaceId = sessionContext.getWorkspaceId(),
) {
  return {
    ...headers,
    ...(workspaceId ? { "X-Biaws-Workspace-Id": workspaceId } : {}),
  };
}

export function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }

  return url;
}

function reportAuthenticationFailure(response, payload) {
  if (response.status === 401) {
    sessionContext.onUnauthorized({
      code: payload.error?.code || payload.code || "UNAUTHENTICATED",
      reason:
        payload.error?.message || payload.message || "Authentication required",
      statusCode: response.status,
    });
  }
}

export async function readPayload(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    reportAuthenticationFailure(response, payload);
    const deniedPermissions = payload.error?.requiredPermissions || [];
    const error = new Error(
      response.status === 403
        ? `Permissão insuficiente${deniedPermissions.length ? `: ${deniedPermissions.join(", ")}` : ""}.`
        : payload.error?.message ||
            payload.message ||
            `HTTP ${response.status}`,
    );
    error.code =
      payload.error?.code ||
      payload.code ||
      (response.status === 403 ? "FORBIDDEN" : "HTTP_ERROR");
    error.statusCode = response.status;
    error.requiredPermissions = deniedPermissions;
    throw error;
  }

  return payload;
}

export async function executeApiRequest({
  body,
  fetchImpl = fetch,
  logger = defaultLogger,
  method = "GET",
  now = () => Date.now(),
  params,
  path,
  workspaceId,
}) {
  const requestId = nextRequestId();
  const startedAt = now();
  try {
    const response = await fetchImpl(buildUrl(path, params), {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: "include",
      headers: workspaceHeaders(
        body === undefined ? {} : { "Content-Type": "application/json" },
        workspaceId,
      ),
      ...(method === "GET" ? {} : { method }),
    });
    return await readPayload(response);
  } catch (error) {
    reportApiFailure({
      durationMs: Math.max(0, now() - startedAt),
      error,
      logger,
      method,
      path,
      requestId,
    });
    throw error;
  }
}

export async function fetchJson(path, params) {
  return defaultMessagesService.run(
    () => executeApiRequest({ path, params }),
    "Carregando dados…",
    { priority: 0 },
  );
}

export async function sendJson(
  path,
  body,
  params,
  method = "PUT",
  { workspaceId } = {},
) {
  return defaultMessagesService.run(
    () => executeApiRequest({ body, method, params, path, workspaceId }),
    "Salvando alterações…",
    { priority: 0 },
  );
}

export async function deleteJson(path, params) {
  return defaultMessagesService.run(
    () => executeApiRequest({ method: "DELETE", params, path }),
    "Excluindo registro…",
    { priority: 0 },
  );
}
