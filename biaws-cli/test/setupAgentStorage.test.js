import assert from "node:assert/strict";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
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
if [[ "\${1:-}" == "compose" ]]; then
  if [[ -n "\${BIAWS_TEST_DOCKER_LOG:-}" ]]; then
    printf '%s\\n' "\$*" >> "\${BIAWS_TEST_DOCKER_LOG}"
  fi
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
  assert.match(configuredEnv, /^MONGO_PORT=27017$/mu);
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

  const startScript = path.join(instance, "start.sh");
  const stopScript = path.join(instance, "stop.sh");
  const [startContents, stopContents, startMetadata, stopMetadata] =
    await Promise.all([
      readFile(startScript, "utf8"),
      readFile(stopScript, "utf8"),
      stat(startScript),
      stat(stopScript),
    ]);
  assert.match(startContents, /up -d --wait "\$@"/u);
  assert.match(stopContents, /stop "\$@"/u);
  assert.equal(startMetadata.mode & 0o777, 0o755);
  assert.equal(stopMetadata.mode & 0o777, 0o755);

  const dockerLog = path.join(temporaryRoot, "docker.log");
  for (const script of [startScript, stopScript]) {
    const result = spawnSync(script, [], {
      encoding: "utf8",
      env: {
        ...process.env,
        BIAWS_TEST_DOCKER_LOG: dockerLog,
        PATH: `${bin}:${process.env.PATH}`,
      },
    });
    assert.equal(result.status, 0, result.stderr);
  }
  const dockerCommands = await readFile(dockerLog, "utf8");
  assert.match(
    dockerCommands,
    new RegExp(
      `compose --project-directory ${repositoryRoot} --file ${repositoryRoot}/compose.yaml --env-file ${instance}/\\.env --project-name biaws-storage-test up -d --wait`,
      "u",
    ),
  );
  assert.match(
    dockerCommands,
    new RegExp(
      `compose --project-directory ${repositoryRoot} --file ${repositoryRoot}/compose.yaml --env-file ${instance}/\\.env --project-name biaws-storage-test stop`,
      "u",
    ),
  );

  const otherInstance = path.join(instances, "other-instance");
  await mkdir(otherInstance, { recursive: true });
  const otherEnv = await readFile(
    path.join(repositoryRoot, ".env.example"),
    "utf8",
  );
  await writeFile(
    path.join(otherInstance, ".env"),
    otherEnv
      .replace(/^MONGO_PORT=.*$/mu, "MONGO_PORT=27018")
      .replace(/^ISSUE_API_PORT=.*$/mu, "ISSUE_API_PORT=3101")
      .replace(/^ISSUE_UI_PORT=.*$/mu, "ISSUE_UI_PORT=4401"),
  );
  const conflictingPort = runSetup({
    bin,
    instances,
    project,
    extraArguments: ["--mongo-port", "27018"],
  });
  assert.equal(conflictingPort.status, 2);
  assert.match(
    conflictingPort.stderr,
    /A porta 27018 já pertence a outra instância/u,
  );

  const changedMongoPort = runSetup({
    bin,
    instances,
    project,
    extraArguments: ["--mongo-port", "27019"],
  });
  assert.equal(changedMongoPort.status, 0, changedMongoPort.stderr);
  const changedPortEnv = await readFile(path.join(instance, ".env"), "utf8");
  assert.match(changedPortEnv, /^MONGO_PORT=27019$/mu);

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
