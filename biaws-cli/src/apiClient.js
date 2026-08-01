function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/u, "");
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
    if (!response.ok) {
      const error = new Error(
        data?.error?.message || `HTTP ${response.status}`,
      );
      error.statusCode = response.status;
      error.code =
        response.status === 401
          ? "UNAUTHENTICATED"
          : response.status === 403
            ? "FORBIDDEN"
            : "ISSUE_API_ERROR";
      throw error;
    }
    return data;
  }

  return {
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
      signal: (runtimeId, payload) =>
        request(
          `/runtimes/${encodeURIComponent(runtimeId)}/signals`,
          { method: "POST", body: JSON.stringify(payload) },
          `${apiRoot}/monitoring`,
        ),
      listSignals: (runtimeId, options = {}) => {
        const parameters = new URLSearchParams();
        if (options.page) parameters.set("page", options.page);
        if (options.limit) parameters.set("limit", options.limit);
        const query = parameters.size ? `?${parameters}` : "";
        return request(
          `/runtimes/${encodeURIComponent(runtimeId)}/signals${query}`,
          {},
          `${apiRoot}/monitoring`,
        );
      },
    },
  };
}
