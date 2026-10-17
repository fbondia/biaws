import assert from "node:assert/strict";
import { cp, mkdtemp, rm, appendFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateSkills } from "../scripts/validate-skills.mjs";
import { listTools } from "../../biaws-mcp/dist/src/mcp/tools/tools.js";
const tools = new Set(
  listTools()
    .filter((t) => !t.name.endsWith("_eml_file"))
    .map((t) => t.name),
);
test("six portable skills validate from an isolated copy and reject local/tool dependencies", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-plugin-skills-"));
  try {
    const skills = path.join(root, "skills");
    await cp(new URL("../biaws/skills", import.meta.url), skills, { recursive: true });
    const report = await validateSkills(skills, tools);
    assert.equal(report.length, 6);
    assert.ok(report.some((r) => r.name === "biaws-classify-issue" && r.tools.includes("issues_classify")));
    await appendFile(path.join(skills, "setup", "SKILL.md"), "\nUse `not_available_tool`");
    await assert.rejects(validateSkills(skills, tools), /Unavailable remote tool/);
    await appendFile(path.join(skills, "setup", "SKILL.md"), "\n/Users/untrusted/checkout");
    await assert.rejects(validateSkills(skills, tools), /Local runtime dependency/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
