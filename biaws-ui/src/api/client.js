import { runWithGlobalLoading } from "../loadingStore.js";

const API_BASE_URL = (import.meta.env.VITE_ISSUE_API_URL || "").replace(
  /\/$/u,
  "",
);
const WORKSPACE_STORAGE_KEY = "biaws.currentWorkspaceId";

let currentWorkspaceId =
  window.localStorage.getItem(WORKSPACE_STORAGE_KEY) || "";

export function setCurrentWorkspaceId(workspaceId) {
  currentWorkspaceId = String(workspaceId || "").trim();
  if (currentWorkspaceId) {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, currentWorkspaceId);
  } else {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  }
}

export function getCurrentWorkspaceId() {
  return currentWorkspaceId;
}

export function workspaceHeaders(
  headers = {},
  workspaceId = currentWorkspaceId,
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

function reportAuthenticationFailure(response) {
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("biaws:unauthenticated"));
  }
}

export async function readPayload(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    reportAuthenticationFailure(response);
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
  return runWithGlobalLoading(
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

export async function sendJson(path, body, params, method = "PUT") {
  return runWithGlobalLoading(
    async () => {
      const response = await fetch(buildUrl(path, params), {
        method,
        credentials: "include",
        headers: workspaceHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(body),
      });
      return readPayload(response);
    },
    "Salvando alterações…",
    { priority: 0 },
  );
}

export async function deleteJson(path, params) {
  return runWithGlobalLoading(
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
