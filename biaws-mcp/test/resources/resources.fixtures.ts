const W = "biaws://workspaces/workspace-a";

async function withApi(
  handler: (url: URL, options: RequestInit) => Response | Promise<Response>,
  operation: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalWorkspace = process.env.BIAWS_WORKSPACE_ID;
  const originalBase = process.env.BIAWS_API_URL;
  process.env.BIAWS_WORKSPACE_ID = "workspace-a";
  process.env.BIAWS_API_URL = "http://api.test";
  globalThis.fetch = async (url, options) => handler(new URL(url instanceof Request ? url.url : url), options || {});
  try {
    await operation();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWorkspace === undefined) delete process.env.BIAWS_WORKSPACE_ID;
    else process.env.BIAWS_WORKSPACE_ID = originalWorkspace;
    if (originalBase === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBase;
  }
}

function json(value: unknown) {
  return Response.json(value);
}
export { W, json, withApi };
