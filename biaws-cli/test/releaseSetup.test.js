import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repository = fileURLToPath(new URL("../../", import.meta.url));

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "biaws-release-setup-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const file of [
    ".env.example",
    "release.json",
    "scripts/setup-server.sh",
    "scripts/release-manifest.mjs",
    "biaws-cli/package.json",
    "biaws-cli/src/instance/release.js",
    "biaws-cli/src/core/errors.js",
    "biaws-api/package.json",
    "biaws-ui/package.json",
    "biaws-monitor-executor/package.json",
  ]) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.copyFile(path.join(repository, file), path.join(root, file));
  }
  await fs.writeFile(path.join(root, "scripts/check-prerequisites.sh"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await fs.writeFile(
    path.join(root, "scripts/bootstrap.sh"),
    '#!/bin/sh\nprintf "%s" "$BIAWS_VERSION" > "$BIAWS_INSTANCES_DIR/bootstrap-version"\nexit "${TEST_BOOTSTRAP_EXIT:-0}"\n',
    { mode: 0o755 },
  );
  return root;
}

function setup(root, options = [], environment = {}) {
  return spawnSync(
    "bash",
    [
      path.join(root, "scripts/setup-server.sh"),
      "--instance",
      "test",
      "--instances-dir",
      path.join(root, "instances"),
      "--mongo-port",
      "39117",
      "--api-port",
      "39110",
      "--ui-port",
      "39410",
      "--use-docker-volumes",
      ...options,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, ...environment },
    },
  );
}

test("setup real grava o manifesto validado após bootstrap e preserva estado com --skip-bootstrap", async (t) => {
  const root = await fixture(t);
  const result = setup(root);
  assert.equal(result.status, 0, result.stderr);
  const expected = JSON.parse(await fs.readFile(path.join(root, "release.json"), "utf8"));
  const state = path.join(root, "instances/test/release.json");
  assert.deepEqual(JSON.parse(await fs.readFile(state, "utf8")), expected);
  assert.equal(await fs.readFile(path.join(root, "instances/bootstrap-version"), "utf8"), expected.version);
  assert.equal((await fs.stat(state)).mode & 0o777, 0o600);
  expected.deploymentRevision++;
  await fs.writeFile(path.join(root, "release.json"), JSON.stringify(expected));
  const skipped = setup(root, ["--skip-bootstrap"]);
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.notDeepEqual(JSON.parse(await fs.readFile(state, "utf8")), expected);
});

test("setup que falha no bootstrap não registra release aplicada", async (t) => {
  const root = await fixture(t);
  const result = setup(root, [], { TEST_BOOTSTRAP_EXIT: "1" });
  assert.equal(result.status, 1);
  await assert.rejects(fs.readFile(path.join(root, "instances/test/release.json")), { code: "ENOENT" });
  const env = await fs.readFile(path.join(root, "instances/test/.env"), "utf8");
  assert.match(env, /^BIAWS_VERSION=unknown$/mu);
});

test("setup rejeita manifesto divergente antes de criar a instância", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "biaws-api/package.json"), '{"version":"99.0.0"}');
  const result = setup(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release.json diverge/u);
  await assert.rejects(fs.stat(path.join(root, "instances/test")), { code: "ENOENT" });
});
