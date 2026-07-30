function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/u, "");
}

export function createApiClient(baseUrl, apiKey, workspaceId = "") {
  const root = `${trimTrailingSlash(baseUrl)}/api/skills`;

  async function request(path = "", options = {}) {
    const response = await fetch(`${root}${path}`, {
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
  };
}
