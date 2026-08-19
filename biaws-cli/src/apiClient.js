function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/u, "");
}

function errorCodeForStatus(status) {
  const codes = {
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
  };
  return codes[status] || "ISSUE_API_ERROR";
}

function apiError(response, data) {
  const error = new Error(data?.error?.message || `HTTP ${response.status}`);
  error.statusCode = response.status;
  error.code = data?.error?.code || errorCodeForStatus(response.status);
  return error;
}

export function createApiClient(baseUrl, apiKey, workspaceId = "") {
  const apiRoot = `${trimTrailingSlash(baseUrl)}/api`;
  const root = `${apiRoot}/skills`;

  async function request(path = "", options = {}, requestRoot = root) {
    const response = await fetch(`${requestRoot}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(workspaceId ? { "X-Biaws-Workspace-Id": workspaceId } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw apiError(response, data);
    return data;
  }

  return {
    request: (path, options = {}) => request(path, options, apiRoot),
    identity: () => request("/auth/me", {}, apiRoot),
    list: (options = {}) =>
      request(options.includeDeprecated ? "?includeDeprecated=true" : ""),
    get: (skillId, version) =>
      request(
        `/${encodeURIComponent(skillId)}${version ? `?version=${encodeURIComponent(version)}` : ""}`,
      ),
    download: (skillId, version) =>
      request(
        `/${encodeURIComponent(skillId)}/${encodeURIComponent(version)}/download`,
      ),
    publish: (payload) =>
      request("", { method: "POST", body: JSON.stringify(payload) }),
    monitoring: {
      describeTemplate: (templateId, version) =>
        request(
          `/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}/contract`,
          {},
          `${apiRoot}/monitoring`,
        ),
      validateTemplate: (templateId, version, sample) =>
        request(
          `/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}/validate`,
          { method: "POST", body: JSON.stringify({ sample }) },
          `${apiRoot}/monitoring`,
        ),
      signal: (runtimeReference, payload) =>
        request(
          `/runtimes/${encodeURIComponent(runtimeReference)}/signals`,
          { method: "POST", body: JSON.stringify(payload) },
          `${apiRoot}/monitoring`,
        ),
      listSignals: (runtimeReference, options = {}) => {
        const parameters = new URLSearchParams();
        if (options.page) parameters.set("page", options.page);
        if (options.limit) parameters.set("limit", options.limit);
        const query = parameters.size ? `?${parameters}` : "";
        return request(
          `/runtimes/${encodeURIComponent(runtimeReference)}/signals${query}`,
          {},
          `${apiRoot}/monitoring`,
        );
      },
    },
  };
}
