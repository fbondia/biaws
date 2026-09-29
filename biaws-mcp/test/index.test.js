import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
for (const mode of ["legacy", { pin: "2026-07-28" }]) {
  test(`stdio entrypoint separates protocol and diagnostics (${JSON.stringify(mode)})`, async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(packageDirectory, "src/index.js")],
      env: {
        ...process.env,
        BIAWS_ENV_FILE: path.join(packageDirectory, "missing-test.env"),
        BIAWS_MCP_LOG_LEVEL: "info",
      },
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    const client = new Client(
      { name: "stdio-test", version: "1.0.0" },
      { versionNegotiation: { mode } },
    );
    try {
      await client.connect(transport);
      assert.equal(client.getServerVersion().version, "0.11.0");
      assert.ok((await client.listTools()).tools.length > 0);
    } finally {
      await client.close();
    }
    const diagnostics = stderr.trim().split(/\r?\n/u).map(JSON.parse);
    assert.ok(diagnostics.some(({ event }) => event === "mcp_server_started"));
    assert.ok(diagnostics.some(({ event }) => event === "mcp_server_stopped"));
    assert.ok(diagnostics.every(({ executionId }) => executionId));
  });
}
