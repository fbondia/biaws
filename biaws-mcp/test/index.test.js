import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("stdio entrypoint keeps protocol on stdout and diagnostics on stderr", async () => {
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: packageDirectory,
    env: {
      ...process.env,
      BIAWS_ENV_FILE: path.join(packageDirectory, "missing-test.env"),
      BIAWS_MCP_LOG_LEVEL: "info",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));

  child.stdin.end(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {} },
    })}\n`,
  );
  const [exitCode] = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (...args) => resolve(args));
  });

  assert.equal(exitCode, 0);
  const protocolLines = stdout.trim().split(/\r?\n/u).map(JSON.parse);
  assert.equal(protocolLines.length, 1);
  assert.equal(protocolLines[0].result.serverInfo.version, "0.8.0");

  const diagnosticLines = stderr.trim().split(/\r?\n/u).map(JSON.parse);
  assert.deepEqual(
    diagnosticLines.map(({ event }) => event),
    [
      "mcp_server_started",
      "mcp_input_closed",
      "mcp_shutdown_requested",
      "mcp_server_stopped",
    ],
  );
  assert.ok(diagnosticLines.every(({ executionId }) => executionId));
});
