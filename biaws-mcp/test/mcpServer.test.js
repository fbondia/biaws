import assert from "node:assert/strict";
import test from "node:test";

import { createMcpMessageHandler, protocolError } from "../src/mcpServer.js";
import { currentRequestSignal } from "../src/requestContext.js";

function createServer(dispatchTool) {
  const messages = [];
  return {
    messages,
    server: createMcpMessageHandler({
      dispatchTool,
      listTools: () => [],
      writeMessage: (message) => messages.push(message),
    }),
  };
}

test("tool failures are successful JSON-RPC responses with MCP isError", async () => {
  const error = new Error("Permission denied");
  error.code = "FORBIDDEN";
  error.statusCode = 403;
  error.requiredPermissions = ["issues.write"];
  error.requestId = "api-request-123";
  error.retryable = false;
  const { messages, server } = createServer(async () => {
    throw error;
  });

  await server.accept({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "issues_create", arguments: {} },
  });

  assert.equal(messages[0].error, undefined);
  assert.equal(messages[0].result.isError, true);
  assert.deepEqual(messages[0].result.structuredContent, {
    error: {
      code: "FORBIDDEN",
      message: "Permission denied",
      status: 403,
      requiredPermissions: ["issues.write"],
      requestId: "api-request-123",
      retryable: false,
    },
  });
  assert.doesNotMatch(messages[0].result.content[0].text, /mcpServer\.test/u);
});

test("a stalled tool does not block another call and can be cancelled", async () => {
  const { messages, server } = createServer(async (name) => {
    if (name === "fast") return { ok: true };
    const signal = currentRequestSignal();
    return new Promise((resolve, reject) => {
      signal.addEventListener(
        "abort",
        () => {
          const error = new Error("The MCP request was cancelled");
          error.code = "REQUEST_CANCELLED";
          error.statusCode = 499;
          error.retryable = false;
          reject(error);
        },
        { once: true },
      );
    });
  });

  const stalled = server.accept({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "slow", arguments: {} },
  });
  await server.accept({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "fast", arguments: {} },
  });
  assert.equal(messages[0].id, 2);

  await server.accept({
    jsonrpc: "2.0",
    method: "notifications/cancelled",
    params: { requestId: 1, reason: "No longer needed" },
  });
  await stalled;
  assert.equal(messages[1].id, 1);
  assert.equal(
    messages[1].result.structuredContent.error.code,
    "REQUEST_CANCELLED",
  );
});

test("JSON-RPC protocol errors always use numeric codes", () => {
  const response = protocolError(3, -32601, "Method not found");
  assert.equal(typeof response.error.code, "number");
  assert.equal(response.error.code, -32601);
});
