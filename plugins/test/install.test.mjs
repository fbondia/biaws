import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
