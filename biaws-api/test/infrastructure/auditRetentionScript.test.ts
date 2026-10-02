import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WORKSPACE_ROOT } from "../../src/helpers/runtimePaths.js";

test("audit retention Compose script defaults to inspection and forwards instance options intact", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "biaws-audit-script-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, "docker"), '#!/usr/bin/env bash\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
  const script = path.join(WORKSPACE_ROOT, "scripts/recalculate-audit-retention.sh");
  const run = (...args: string[]) =>
    spawnSync("bash", [script, ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    });

  const inspect = run();
  assert.equal(inspect.status, 0, inspect.stderr);
  assert.equal(inspect.stdout.includes("--apply"), false);
  assert.ok(inspect.stdout.includes("exec\n-T\napi\nnode\ndist/biaws-api/src/scripts/recalculateAuditRetention.js"));

  const apply = run("--apply", "--", "--env-file", "/tmp/synthetic instance/.env", "--project-name", "synthetic");
  assert.equal(apply.status, 0, apply.stderr);
  assert.ok(apply.stdout.includes("--env-file\n/tmp/synthetic instance/.env\n--project-name\nsynthetic\n"));
  assert.ok(apply.stdout.endsWith("--apply\n"));

  const help = run("--help");
  assert.equal(help.status, 0);
  assert.ok(help.stdout.startsWith("Uso:"));
  const unknown = run("--aply");
  assert.equal(unknown.status, 2);
  assert.equal(unknown.stdout, "");
});
