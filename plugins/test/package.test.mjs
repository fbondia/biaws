import assert from "node:assert/strict";
import { mkdtemp, rm, cp, readFile, writeFile, appendFile, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { unzipSync } from "fflate";
import { buildPlugin } from "../scripts/build.mjs";
test("plugin ZIP is deterministic from a clean source copy and contains only the remote payload", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-plugin-package-"));
  try {
    const source = path.join(root, "source");
    await cp(new URL("../biaws", import.meta.url), source, { recursive: true });
    const first = await buildPlugin({
      url: "https://synthetic.example.test/mcp",
      outputDirectory: path.join(root, "a"),
      sourceDirectory: source,
    });
    const second = await buildPlugin({
      url: "https://synthetic.example.test/mcp",
      outputDirectory: path.join(root, "b"),
      sourceDirectory: source,
    });
    assert.equal(first.sha256, second.sha256);
    const zip = unzipSync(new Uint8Array(await readFile(path.join(root, "a", first.name))));
    assert.equal(Object.keys(zip).length, 10);
    const mcp = JSON.parse(Buffer.from(zip["mcp.json"]).toString());
    assert.equal(mcp.mcpServers.biaws.extensions["com.openai"].auth.client.mode, "cimd");
    assert.equal(mcp.mcpServers.biaws.url, "https://synthetic.example.test/mcp");
    assert.equal(
      Object.keys(zip).some((name) => /env|node_modules|app.json/u.test(name)),
      false,
    );
    await assert.rejects(buildPlugin({ outputDirectory: root, sourceDirectory: source }), /--url/);
    await assert.rejects(
      buildPlugin({ url: "http://remote.example.test/mcp", outputDirectory: root, sourceDirectory: source }),
      /HTTPS/,
    );
    await writeFile(path.join(source, ".env"), "private");
    await assert.rejects(
      buildPlugin({ url: "https://synthetic.example.test/mcp", outputDirectory: root, sourceDirectory: source }),
      /Unexpected payload/,
    );
    await rm(path.join(source, ".env"));
    await symlink("mcp.json", path.join(source, "unexpected-link"));
    await assert.rejects(
      buildPlugin({ url: "https://synthetic.example.test/mcp", outputDirectory: root, sourceDirectory: source }),
      /Symlinks/,
    );
    await rm(path.join(source, "unexpected-link"));
    await appendFile(path.join(source, "skills/setup/SKILL.md"), "\n-----BEGIN PRIVATE KEY-----");
    await assert.rejects(
      buildPlugin({ url: "https://synthetic.example.test/mcp", outputDirectory: root, sourceDirectory: source }),
      /Credential-like/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
