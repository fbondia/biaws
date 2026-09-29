import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { required } from "../../helpers/types.js";
import { packageDirectory } from "./index.fixtures.js";
for (const mode of ["legacy", { pin: "2026-07-28" }] as const) {
  test(`stdio entrypoint separates protocol and diagnostics (${JSON.stringify(mode)})`, async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(packageDirectory, "dist/src/index.js")],
      env: {
        ...process.env,
        BIAWS_ENV_FILE: path.join(packageDirectory, "missing-test.env"),
        BIAWS_MCP_LOG_LEVEL: "info",
      },
      stderr: "pipe",
    });
    let stderr = "";
    required(transport.stderr).on("data", (chunk: Buffer) => {
      stderr += chunk;
    });
    const client = new Client({ name: "stdio-test", version: "1.0.0" }, { versionNegotiation: { mode } });
    try {
      await client.connect(transport);
      assert.equal(required(client.getServerVersion()).version, "0.11.0");
      assert.ok((await client.listTools()).tools.length > 0);
    } finally {
      await client.close();
    }
    const diagnostics = stderr
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    assert.ok(diagnostics.some(({ event }) => event === "mcp_server_started"));
    assert.ok(diagnostics.some(({ event }) => event === "mcp_server_stopped"));
    assert.ok(diagnostics.every(({ executionId }) => executionId));
  });
}
