function jsonResponse(payload: unknown = { ok: true }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function withHttpClient(
  testFunction: (
    calls: { url: string; options: RequestInit }[],
  ) => Promise<void>,
) {
  return async () => {
    const originalFetch = globalThis.fetch;
    const originalBaseUrl = process.env.BIAWS_API_URL;
    const originalApiKey = process.env.BIAWS_API_KEY;
    const originalWorkspaceId = process.env.BIAWS_WORKSPACE_ID;
    process.env.BIAWS_API_URL = "http://api.test";
    process.env.BIAWS_API_KEY = "biaws_test_key";
    process.env.BIAWS_WORKSPACE_ID = "workspace-1";
    const calls: { url: string; options: RequestInit }[] = [];
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return jsonResponse();
    };
    try {
      await testFunction(calls);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [name, value] of [
        ["BIAWS_API_URL", originalBaseUrl],
        ["BIAWS_API_KEY", originalApiKey],
        ["BIAWS_WORKSPACE_ID", originalWorkspaceId],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  };
}
export { jsonResponse, withHttpClient };
