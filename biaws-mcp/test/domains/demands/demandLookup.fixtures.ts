const demandId = "507f1f77bcf86cd799439011";

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}

async function withMockApi(
  fetch: typeof globalThis.fetch,
  operation: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  globalThis.fetch = fetch;
  try {
    await operation();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
}
export { demandId, response, withMockApi };
