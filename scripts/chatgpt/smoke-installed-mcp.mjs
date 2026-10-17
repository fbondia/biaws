import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Client } from "../../biaws-mcp/node_modules/@modelcontextprotocol/client/dist/index.mjs";
import { StdioClientTransport } from "../../biaws-mcp/node_modules/@modelcontextprotocol/client/dist/stdio.mjs";

// Test tooling uses the checkout's official client; the server and its runtime
// dependencies must come exclusively from the isolated npm installation.
const directory = path.resolve(process.argv[2] ?? "");
assert.ok(process.argv[2], "Informe o diretório node_modules/biaws-mcp instalado do tarball");
const metadata = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
for (const entry of ["biaws-mcp", "biaws-mcp-http"]) {
  const file = path.join(directory, metadata.bin[entry]);
  assert.match(await readFile(file, "utf8"), /^#!\/usr\/bin\/env node/u);
  if (process.platform !== "win32") assert.ok((await stat(file)).mode & 0o111);
}
for (const mode of ["legacy", { pin: "2026-07-28" }]) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(directory, metadata.bin["biaws-mcp"])],
    env: { PATH: process.env.PATH ?? "", BIAWS_ENV_FILE: path.join(directory, "missing-smoke.env") },
    stderr: "pipe",
  });
  transport.stderr?.resume();
  const client = new Client({ name: "installed-tarball-smoke", version: "1.0.0" }, { versionNegotiation: { mode } });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.version, metadata.version);
    assert.ok((await client.listTools()).tools.length > 0);
    assert.ok((await client.listResources()).resources.length > 0);
  } finally {
    await client.close();
  }
  console.log(`Installed ${metadata.name}@${metadata.version}: ${JSON.stringify(mode)} passed`);
}
