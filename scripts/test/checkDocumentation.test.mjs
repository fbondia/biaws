import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function check(t, markdown) {
  const root = mkdtempSync(path.join(os.tmpdir(), "biaws-documentation-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, "biaws-mcp"));
  cpSync(new URL("../check-documentation.mjs", import.meta.url), path.join(root, "scripts/check-documentation.mjs"));
  writeFileSync(path.join(root, "biaws-mcp/package.json"), JSON.stringify({ version: "1.0.0" }));
  for (const file of ["README.md", "QUICKSTART.md", "biaws-mcp/README.md"]) writeFileSync(path.join(root, file), "");
  writeFileSync(path.join(root, "guide.md"), markdown);
  return spawnSync(process.execPath, [path.join(root, "scripts/check-documentation.mjs")], { encoding: "utf8" });
}

test("ignores link examples in code spans, including nested backticks and multiple lines", (t) => {
  const result = check(
    t,
    [
      "Use `[texto](url)` or `` `[texto](url)` ``.",
      "A span may cover `multiple",
      "lines with [texto](url)`.",
      "Real [link](README.md) and [external](https://example.test) still work.",
    ].join("\n"),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Documentação validada/u);
});

test("ignores fenced code with backticks or tildes and shorter embedded fences", (t) => {
  const result = check(
    t,
    [
      "````markdown",
      "[texto](url)",
      "```",
      "[texto](another-example)",
      "````",
      "   ~~~markdown",
      "[texto](url)",
      "   ~~~~",
      "[real](README.md)",
    ].join("\n"),
  );
  assert.equal(result.status, 0, result.stderr);
});

test("reports broken prose links beside code and preserves original line numbers", (t) => {
  const result = check(
    t,
    [
      "# Guide",
      "Example `[texto](url)` and [broken](missing.md).",
      "```markdown",
      "[ignored](example.md)",
      "```",
      "`🧪 [ignored](inline.md)` [broken](also-missing.md)",
    ].join("\n"),
  );
  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    ["guide.md:2: link local inexistente: missing.md", "guide.md:6: link local inexistente: also-missing.md", ""].join(
      "\n",
    ),
  );
});

test("unmatched and escaped backticks do not hide broken links", (t) => {
  const result = check(t, "An unmatched ` leaves [broken](missing.md) visible.\n");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /guide\.md:1: link local inexistente: missing\.md/u);
  const escaped = check(t, "\\`[broken](missing.md)\\`\n");
  assert.equal(escaped.status, 1);
  assert.match(escaped.stderr, /guide\.md:1: link local inexistente: missing\.md/u);
});
