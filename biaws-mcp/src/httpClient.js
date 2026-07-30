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
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(workspaceId ? { "X-Biaws-Workspace-Id": workspaceId } : {}),
  };
}

function responseError(response, payload) {
  const error = new Error(payload.error?.message || `HTTP ${response.status}`);
  error.statusCode = response.status;
  error.code =
    payload.error?.code ||
    {
      400: "BAD_REQUEST",
      401: "UNAUTHENTICATED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
    }[response.status] ||
    "ISSUE_API_ERROR";
  return error;
}

export function cleanParams(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== null && entry !== "",
    ),
  );
}

export async function fetchJson(path, params = {}) {
  const url = buildUrl(path, params);
  let response;

  try {
    response = await fetch(url, { headers: authenticationHeaders() });
  } catch (error) {
    throw new Error(
      `Failed to reach biaws-api at ${url.origin}: ${error.message}`,
      { cause: error },
    );
  }
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw responseError(response, payload);
  }

  return payload;
}

export async function sendJson(path, body = {}, params = {}, method = "PUT") {
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authenticationHeaders(),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw responseError(response, payload);
  }

  return payload;
}

export async function deleteJson(path, params = {}) {
  const response = await fetch(buildUrl(path, params), {
    method: "DELETE",
    headers: authenticationHeaders(),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw responseError(response, payload);
  }

  return payload;
}

export async function sendMultipart(path, form, params = {}) {
  const response = await fetch(buildUrl(path, params), {
    method: "POST",
    headers: authenticationHeaders(),
    body: form,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw responseError(response, payload);
  }

  return payload;
}
