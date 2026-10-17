import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync, zipSync } from "fflate";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { buildPlugin } from "../scripts/build.mjs";
import { verifyInstall } from "../scripts/verify-install.mjs";
test("archive installs offline in an empty directory with no personal connection; checksum is enforced", async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), "biaws-install-test-"));
  try {
    const report = await buildPlugin({ url: "https://synthetic.example.test/mcp", outputDirectory: out });
    const installed = await verifyInstall(path.join(out, report.name), report.sha256);
    assert.equal(installed.skills.length, 6);
    assert.equal(installed.realChatgptValidation, "pending");
    await assert.rejects(verifyInstall(path.join(out, report.name), "0".repeat(64)), /checksum mismatch/);
    const original = await readFile(path.join(out, report.name));
    for (const change of ["sse", "headers", "icon"]) {
      const entries = unzipSync(original);
      if (change === "icon") entries["assets/icon.png"] = new Uint8Array(33);
      else {
        const mcp = JSON.parse(Buffer.from(entries["mcp.json"]).toString());
        if (change === "sse") mcp.mcpServers.biaws.type = "sse";
        else mcp.mcpServers.biaws.headers = { Cookie: "synthetic" };
        entries["mcp.json"] = Buffer.from(JSON.stringify(mcp));
      }
      const bytes = zipSync(entries);
      const invalid = path.join(out, "invalid.zip");
      await writeFile(invalid, bytes);
      await assert.rejects(
        verifyInstall(invalid, createHash("sha256").update(bytes).digest("hex")),
        change === "icon" ? /square PNG icon/u : /Only Streamable HTTP/u,
      );
    }
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
