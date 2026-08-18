import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import { CliLogger, CliOutput } from "../src/core/terminal.js";

function captureTerminal() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let output = "";
  let diagnostics = "";
  stdout.on("data", (chunk) => (output += chunk));
  stderr.on("data", (chunk) => (diagnostics += chunk));
  return {
    terminal: { stdout, stderr, isCI: true, isInteractive: false },
    output: () => output,
    diagnostics: () => diagnostics,
  };
}

test("CliOutput keeps JSON on stdout and redacts secret fields", () => {
  const capture = captureTerminal();
  const output = new CliOutput(capture.terminal, {
    json: true,
    secrets: ["private-key"],
  });
  output.result({ ok: true, apiKey: "private-key", detail: "private-key" });

  assert.deepEqual(JSON.parse(capture.output()), {
    ok: true,
    apiKey: "[REDACTED]",
    detail: "[REDACTED]",
  });
  assert.equal(capture.diagnostics(), "");
});

test("CliLogger writes structured redacted diagnostics to stderr", () => {
  const capture = captureTerminal();
  const logger = new CliLogger(capture.terminal, {
    secrets: ["private-key"],
  });
  logger.info("api_request_failed", {
    authorization: "Bearer private-key",
    reason: "rejected private-key",
  });

  assert.deepEqual(JSON.parse(capture.diagnostics()), {
    level: "info",
    event: "api_request_failed",
    authorization: "[REDACTED]",
    reason: "rejected [REDACTED]",
  });
  assert.equal(capture.output(), "");
});
