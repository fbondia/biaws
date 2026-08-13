import assert from "node:assert/strict";
import test from "node:test";

import { createExecutorApiClient, ExecutorApiError } from "../src/apiClient.js";

test("executor client sends technical identity and workspace only to the API", async () => {
  let captured;
  const client = createExecutorApiClient(
    {
      apiUrl: "https://biaws.example.test/",
      apiKey: "biaws_test_key",
      workspaceId: "workspace-test",
      requestTimeoutMs: 1_000,
    },
    {
      fetchImpl: async (url, options) => {
        captured = { url, options };
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      },
    },
  );

  await client.acquire({ executorId: "runner-1", limit: 2, leaseSeconds: 60 });

  assert.equal(
    captured.url,
    "https://biaws.example.test/api/monitoring/executor/leases",
  );
  assert.equal(captured.options.headers.Authorization, "Bearer biaws_test_key");
  assert.equal(
    captured.options.headers["X-Biaws-Workspace-Id"],
    "workspace-test",
  );
  assert.deepEqual(JSON.parse(captured.options.body), {
    executorId: "runner-1",
    limit: 2,
    leaseSeconds: 60,
  });
});

test("executor client classifies transient and lease errors", async () => {
  let status = 503;
  const client = createExecutorApiClient(
    {
      apiUrl: "https://biaws.example.test",
      apiKey: "test",
      workspaceId: "workspace-test",
      requestTimeoutMs: 1_000,
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: status === 409 ? "ACTIVE_MONITOR_LEASE_LOST" : "TEMPORARY",
              message: "request failed",
            },
          }),
          { status },
        ),
    },
  );

  await assert.rejects(client.acquire({}), (error) => {
    assert.ok(error instanceof ExecutorApiError);
    assert.equal(error.retryable, true);
    return true;
  });
  status = 409;
  await assert.rejects(client.renew("lease-1", {}), (error) => {
    assert.equal(error.code, "ACTIVE_MONITOR_LEASE_LOST");
    assert.equal(error.retryable, false);
    return true;
  });
});
