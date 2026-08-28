import assert from "node:assert/strict";
import test from "node:test";

import { createLogger } from "../src/logger.js";

function captureStream() {
  const lines = [];
  return {
    lines,
    stream: { write: (line) => lines.push(line) },
  };
}

test("structured logger writes correlated JSON and redacts secrets", () => {
  const capture = captureStream();
  const logger = createLogger({
    service: "biaws-mcp",
    version: "0.5.0",
    executionId: "execution-1",
    level: "debug",
    stream: capture.stream,
    now: () => "2026-08-28T12:00:00.000Z",
  });

  const cause = new Error(
    "request to https://user:pass@example.test/path?token=visible failed",
  );
  cause.code = "ECONNRESET";
  logger.error("mcp_test_failed", {
    requestId: "request-1",
    authorization: "Bearer visible",
    error: new Error("Bearer visible", { cause }),
  });

  const record = JSON.parse(capture.lines[0]);
  assert.equal(record.event, "mcp_test_failed");
  assert.equal(record.requestId, "request-1");
  assert.equal(record.authorization, "[REDACTED]");
  assert.equal(record.error.message, "Bearer [REDACTED]");
  assert.doesNotMatch(JSON.stringify(record), /user:pass|token=visible/u);
  assert.match(JSON.stringify(record), /\[REDACTED\]/u);
});

test("logger contains its own stream failures", () => {
  const logger = createLogger({
    service: "biaws-mcp",
    version: "0.5.0",
    executionId: "execution-1",
    stream: {
      write() {
        throw new Error("broken stderr");
      },
    },
  });

  assert.equal(logger.info("mcp_test_event"), false);
});
