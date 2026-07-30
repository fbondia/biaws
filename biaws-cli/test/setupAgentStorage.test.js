import assert from "node:assert/strict";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function createFakeRuntime(root) {
  const bin = path.join(root, "bin");
  await mkdir(bin, { recursive: true });
  const node = path.join(bin, "node");
  const docker = path.join(bin, "docker");
  await writeFile(
    node,
    `#!/usr/bin/env bash
if [[ "\${1:-}" == "-p" ]]; then
  echo 22
fi
exit 0
`,
  );
  await writeFile(
    docker,
    `#!/usr/bin/env bash
if [[ "\${1:-}" == "compose" && "\${2:-}" == "version" ]]; then
  exit 0
fi
exit 1
`,
  );
  await chmod(node, 0o755);
  await chmod(docker, 0o755);
  return bin;
}

function runSetup({ bin, instances, project, extraArguments = [] }) {
  return spawnSync(
    path.join(repositoryRoot, "scripts", "setup-agent.sh"),
    [
      "--instance",
      "storage-test",
      "--client",
      "codex",
      "--project",
      project,
      "--instances-dir",
      instances,
      "--skip-bootstrap",
      ...extraArguments,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
      },
    },
  );
}

test("setup stores bind mount paths and can return to Docker volumes", async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "biaws-setup-storage-"),
  );
  const instances = path.join(temporaryRoot, "instances");
  const instance = path.join(instances, "storage-test");
  const project = path.join(temporaryRoot, "project");
  const storage = path.join(temporaryRoot, "storage");
  await mkdir(instance, { recursive: true });
  await mkdir(project, { recursive: true });
  await copyFile(
    path.join(repositoryRoot, ".env.example"),
    path.join(instance, ".env"),
  );
  const bin = await createFakeRuntime(temporaryRoot);

  const configured = runSetup({
    bin,
    instances,
    project,
    extraArguments: ["--storage-dir", storage],
  });
  assert.equal(configured.status, 0, configured.stderr);

  const configuredEnv = await readFile(path.join(instance, ".env"), "utf8");
  const canonicalStorage = await realpath(storage);
  assert.match(
    configuredEnv,
    new RegExp(`^BIAWS_MONGO_DATA_PATH=${canonicalStorage}/mongo$`, "mu"),
  );
  assert.match(
    configuredEnv,
    new RegExp(`^BIAWS_ISSUE_FILES_PATH=${canonicalStorage}/issues$`, "mu"),
  );
  assert.match(
    configuredEnv,
    new RegExp(`^BIAWS_REQUEST_FILES_PATH=${canonicalStorage}/requests$`, "mu"),
  );
  assert.match(
    configuredEnv,
    new RegExp(
      `^BIAWS_PROCEDURE_FILES_PATH=${canonicalStorage}/procedures$`,
      "mu",
    ),
  );

  const reset = runSetup({
    bin,
    instances,
    project,
    extraArguments: ["--use-docker-volumes"],
  });
  assert.equal(reset.status, 0, reset.stderr);

  const resetEnv = await readFile(path.join(instance, ".env"), "utf8");
  assert.match(resetEnv, /^BIAWS_MONGO_DATA_PATH=$/mu);
  assert.match(resetEnv, /^BIAWS_ISSUE_FILES_PATH=$/mu);
  assert.match(resetEnv, /^BIAWS_REQUEST_FILES_PATH=$/mu);
  assert.match(resetEnv, /^BIAWS_PROCEDURE_FILES_PATH=$/mu);

  const overlapping = runSetup({
    bin,
    instances,
    project,
    extraArguments: [
      "--mongo-data-path",
      path.join(storage, "shared"),
      "--issue-files-path",
      path.join(storage, "shared", "issues"),
    ],
  });
  assert.equal(overlapping.status, 2);
  assert.match(overlapping.stderr, /não podem ser iguais nem aninhados/u);
});
