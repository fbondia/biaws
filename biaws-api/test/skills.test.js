import assert from "node:assert/strict";
import test from "node:test";

import {
  compareSemver,
  normalizeSkillPayload,
} from "../src/repositories/skillsRepository.js";

test("normalizes a versioned skill package and calculates checksums", () => {
  const skill = normalizeSkillPayload({
    skillId: "biaws-example",
    version: "1.2.0",
    name: "Bondia Example",
    description: "Example skill",
    files: [
      { path: "references/example.md", content: "reference" },
      { path: "SKILL.md", content: "---\nname: biaws-example\n---\n" },
    ],
  });

  assert.equal(skill.skillId, "biaws-example");
  assert.equal(skill.version, "1.2.0");
  assert.equal(skill.files[0].path, "references/example.md");
  assert.match(skill.packageSha256, /^[a-f0-9]{64}$/u);
});

test("rejects unsafe paths and packages without SKILL.md", () => {
  assert.throws(
    () =>
      normalizeSkillPayload({
        skillId: "biaws-example",
        version: "1.0.0",
        description: "Example skill",
        files: [{ path: "../SKILL.md", content: "invalid" }],
      }),
    /Invalid skill file path/u,
  );
  assert.throws(
    () =>
      normalizeSkillPayload({
        skillId: "biaws-example",
        version: "1.0.0",
        description: "Example skill",
        files: [{ path: "README.md", content: "missing" }],
      }),
    /SKILL\.md is required/u,
  );
});

test("orders stable, prerelease and major semantic versions", () => {
  assert.ok(compareSemver("1.0.0", "1.0.0-beta.1") > 0);
  assert.ok(compareSemver("2.0.0", "1.99.99") > 0);
  assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
});
