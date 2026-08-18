import assert from "node:assert/strict";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
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
if [[ -n "\${BIAWS_TEST_NODE_LOG:-}" ]]; then
  printf '%s\\n' "\$*" >> "\${BIAWS_TEST_NODE_LOG}"
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
  if [[ " \$* " == *" mongodump "* ]]; then
    printf 'fake-mongo-archive'
  fi
  exit 0
fi
if [[ "\${1:-}" == "info" ]]; then
  exit 0
fi
exit 1
`,
  );
  await chmod(node, 0o755);
  await chmod(docker, 0o755);
  return bin;
}

function runSetup({
  bin,
  instances,
  publicUrl = "https://ci.example.test",
  extraArguments = [],
}) {
  const publicUrlArguments = publicUrl ? ["--public-url", publicUrl] : [];
  return spawnSync(
    path.join(repositoryRoot, "scripts", "setup-server.sh"),
    [
      "--instance",
      "storage-test",
      ...publicUrlArguments,
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
        BIAWS_TEST_DOCKER_LOG: path.join(path.dirname(instances), "docker.log"),
        BIAWS_TEST_NODE_LOG: path.join(path.dirname(instances), "node.log"),
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
  await writeFile(
    path.join(instance, ".env"),
    `${await readFile(path.join(instance, ".env"), "utf8")}\nISSUE_WORKSPACE_ID=legacy-workspace\n`,
  );
  const bin = await createFakeRuntime(temporaryRoot);

  const configured = runSetup({
    bin,
    instances,
    project,
    extraArguments: [
      "--storage-dir",
      storage,
      "--api-rate-limit-max",
      "450",
      "--api-rate-limit-window-seconds",
      "90",
      "--auth-rate-limit-max",
      "80",
      "--auth-rate-limit-window-seconds",
      "20",
      "--api-key-rate-limit-max",
      "2400",
      "--api-key-rate-limit-window-seconds",
      "7200",
    ],
  });
  assert.equal(configured.status, 0, configured.stderr);

  const configuredEnv = await readFile(path.join(instance, ".env"), "utf8");
  assert.doesNotMatch(configuredEnv, /^ISSUE_WORKSPACE_ID=/mu);
  assert.match(
    configuredEnv,
    /^BIAWS_PUBLIC_URL=https:\/\/ci\.example\.test$/mu,
  );
  assert.match(
    configuredEnv,
    /^BIAWS_TRUSTED_ORIGINS=https:\/\/ci\.example\.test$/mu,
  );
  assert.match(configuredEnv, /^BETTER_AUTH_SECURE_COOKIES=true$/mu);
  const canonicalStorage = await realpath(storage);
  assert.match(configuredEnv, /^MONGO_PORT=27017$/mu);
  assert.match(
    configuredEnv,
    new RegExp(`^BIAWS_MONGO_DATA_PATH=${canonicalStorage}/mongo$`, "mu"),
  );
  assert.match(configuredEnv, /^ISSUE_API_RATE_LIMIT_MAX_REQUESTS=450$/mu);
  assert.match(configuredEnv, /^ISSUE_API_RATE_LIMIT_WINDOW_SECONDS=90$/mu);
  assert.match(configuredEnv, /^BETTER_AUTH_RATE_LIMIT_MAX_REQUESTS=80$/mu);
  assert.match(configuredEnv, /^BETTER_AUTH_RATE_LIMIT_WINDOW_SECONDS=20$/mu);
  assert.match(configuredEnv, /^ISSUE_API_KEY_RATE_LIMIT_MAX_REQUESTS=2400$/mu);
  assert.match(
    configuredEnv,
    /^ISSUE_API_KEY_RATE_LIMIT_WINDOW_SECONDS=7200$/mu,
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
      `^BIAWS_DOCUMENT_FILES_PATH=${canonicalStorage}/documents$`,
      "mu",
    ),
  );
  assert.match(
    configuredEnv,
    new RegExp(`^BIAWS_SECRET_FILES_PATH=${canonicalStorage}/secrets$`, "mu"),
  );
  assert.match(
    configuredEnv,
    new RegExp(`^BIAWS_SECRETS_DIR=${canonicalStorage}/secrets$`, "mu"),
  );
  const expectedSecretsKey = path.join(instance, ".secrets-master-key");
  assert.match(
    configuredEnv,
    new RegExp(`^BIAWS_SECRETS_KEY_PATH=${expectedSecretsKey}$`, "mu"),
  );
  assert.match(
    configuredEnv,
    new RegExp(`^BIAWS_SECRETS_KEY_FILE=${expectedSecretsKey}$`, "mu"),
  );

  const startScript = path.join(instance, "start.sh");
  const stopScript = path.join(instance, "stop.sh");
  const backupScript = path.join(instance, "backup-mongo.sh");
  const restoreScript = path.join(instance, "restore-mongo.sh");
  const [
    startContents,
    stopContents,
    backupContents,
    restoreContents,
    startMetadata,
    stopMetadata,
    backupMetadata,
    restoreMetadata,
  ] = await Promise.all([
    readFile(startScript, "utf8"),
    readFile(stopScript, "utf8"),
    readFile(backupScript, "utf8"),
    readFile(restoreScript, "utf8"),
    stat(startScript),
    stat(stopScript),
    stat(backupScript),
    stat(restoreScript),
  ]);
  assert.match(startContents, /up -d --wait "\$@"/u);
  assert.match(stopContents, /stop "\$@"/u);
  assert.match(backupContents, /exec -T mongo mongodump/u);
  assert.match(backupContents, /--db="\$\{BIAWS_MONGO_DB\}"/u);
  assert.match(restoreContents, /exec -T mongo mongorestore/u);
  assert.match(restoreContents, /--drop/u);
  assert.match(restoreContents, /use --yes para confirmar/u);
  assert.equal(startMetadata.mode & 0o777, 0o755);
  assert.equal(stopMetadata.mode & 0o777, 0o755);
  assert.equal(backupMetadata.mode & 0o777, 0o755);
  assert.equal(restoreMetadata.mode & 0o777, 0o755);

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
  const backupDirectory = path.join(temporaryRoot, "backups");
  const backupResult = spawnSync(backupScript, [backupDirectory], {
    encoding: "utf8",
    env: {
      ...process.env,
      BIAWS_TEST_DOCKER_LOG: dockerLog,
      PATH: `${bin}:${process.env.PATH}`,
    },
  });
  assert.equal(backupResult.status, 0, backupResult.stderr);
  const backupFiles = await readdir(backupDirectory);
  const archiveName = backupFiles.find((file) => file.endsWith(".archive.gz"));
  assert.ok(archiveName);
  assert.ok(backupFiles.includes(`${archiveName}.sha256`));

  const unconfirmedRestore = spawnSync(
    restoreScript,
    [path.join(backupDirectory, archiveName)],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        BIAWS_TEST_DOCKER_LOG: dockerLog,
        PATH: `${bin}:${process.env.PATH}`,
      },
    },
  );
  assert.equal(unconfirmedRestore.status, 2);
  assert.match(unconfirmedRestore.stderr, /use --yes para confirmar/u);

  const restoreResult = spawnSync(
    restoreScript,
    [path.join(backupDirectory, archiveName), "--yes"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        BIAWS_TEST_DOCKER_LOG: dockerLog,
        PATH: `${bin}:${process.env.PATH}`,
      },
    },
  );
  assert.equal(restoreResult.status, 0, restoreResult.stderr);

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
    /exec -T mongo mongodump --db=biaws --archive --gzip/u,
  );
  assert.match(
    dockerCommands,
    /exec -T mongo mongorestore --nsInclude=biaws\.\* --archive --gzip --drop/u,
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
  assert.match(resetEnv, /^BIAWS_DOCUMENT_FILES_PATH=$/mu);
  assert.match(resetEnv, /^BIAWS_SECRET_FILES_PATH=$/mu);

  await writeFile(
    path.join(instance, ".env"),
    resetEnv.replace(
      /^BIAWS_PUBLIC_URL=.*$/mu,
      "BIAWS_PUBLIC_URL=http://localhost:4400",
    ),
  );
  const localOrigin = runSetup({
    bin,
    instances,
    publicUrl: "",
    extraArguments: ["--ui-port", "4417"],
  });
  assert.equal(localOrigin.status, 0, localOrigin.stderr);
  const localEnv = await readFile(path.join(instance, ".env"), "utf8");
  assert.match(localEnv, /^BIAWS_PUBLIC_URL=http:\/\/localhost:4417$/mu);
  assert.match(
    localEnv,
    /^BIAWS_TRUSTED_ORIGINS=http:\/\/localhost:4417,http:\/\/127\.0\.0\.1:4417$/mu,
  );
  assert.match(localEnv, /^BETTER_AUTH_SECURE_COOKIES=false$/mu);

  const invalidOrigin = runSetup({
    bin,
    instances,
    publicUrl: "https://ci.example.test/path",
  });
  assert.equal(invalidOrigin.status, 2);
  assert.match(invalidOrigin.stderr, /URL pública inválida/u);

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

  const missingClient = spawnSync(
    path.join(repositoryRoot, "scripts", "setup-local.sh"),
    ["--instance", "storage-test"],
    { encoding: "utf8" },
  );
  assert.equal(missingClient.status, 2);
  assert.match(missingClient.stderr, /Informe --instance e --client/u);

  const localSetup = spawnSync(
    path.join(repositoryRoot, "scripts", "setup-local.sh"),
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
      "--public-url",
      "http://localhost:4417",
      "--force",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        BIAWS_TEST_NODE_LOG: path.join(temporaryRoot, "node.log"),
      },
    },
  );
  assert.equal(localSetup.status, 0, localSetup.stderr);
  const nodeCommands = await readFile(
    path.join(temporaryRoot, "node.log"),
    "utf8",
  );
  const canonicalProject = await realpath(project);
  assert.match(
    nodeCommands,
    new RegExp(
      `agent configure codex --project ${canonicalProject} --force`,
      "u",
    ),
  );
  assert.match(
    nodeCommands,
    new RegExp(`agent doctor codex --project ${canonicalProject}`, "u"),
  );
});
