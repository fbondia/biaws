import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

// Accept an installed executable; never talks to the API or requires credentials.
const command = process.argv[2] || "node";
const args = process.argv[2] ? [] : ["bin/biaws-mcp.js"];
for (const mode of ["legacy", { pin: "2026-07-28" }]) {
  const transport = new StdioClientTransport({ command, args, stderr: "pipe" });
  const client = new Client({ name: "package-verification", version: "1.0.0" }, { versionNegotiation: { mode } });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, "biaws-mcp");
    assert.ok((await client.listTools()).tools.length > 0);
    assert.ok((await client.listResourceTemplates()).resourceTemplates.length > 0);
  } finally {
    await client.close();
  }
}
process.stdout.write("Handshake e catálogo validados com cliente oficial (2025 e 2026).\n");
