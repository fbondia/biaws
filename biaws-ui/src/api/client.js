import { defaultMessagesService } from "../infrastructure/messages/runtime.js";

const API_BASE_URL = (import.meta.env?.VITE_ISSUE_API_URL || "").replace(
  /\/$/u,
  "",
);
const EMPTY_SESSION_CONTEXT = Object.freeze({
  getWorkspaceId: () => "",
  onUnauthorized: () => {},
});

let sessionContext = EMPTY_SESSION_CONTEXT;

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

export async function fetchJson(path, params) {
  return defaultMessagesService.run(
    async () => {
      const response = await fetch(buildUrl(path, params), {
        credentials: "include",
        headers: workspaceHeaders(),
      });
      return readPayload(response);
    },
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
    async () => {
      const response = await fetch(buildUrl(path, params), {
        method,
        credentials: "include",
        headers: workspaceHeaders(
          {
            "Content-Type": "application/json",
          },
          workspaceId,
        ),
        body: JSON.stringify(body),
      });
      return readPayload(response);
    },
    "Salvando alterações…",
    { priority: 0 },
  );
}

export async function deleteJson(path, params) {
  return defaultMessagesService.run(
    async () => {
      const response = await fetch(buildUrl(path, params), {
        method: "DELETE",
        credentials: "include",
        headers: workspaceHeaders(),
      });
      return readPayload(response);
    },
    "Excluindo registro…",
    { priority: 0 },
  );
}
