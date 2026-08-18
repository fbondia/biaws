import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  backupArguments,
  buildSetupConfiguration,
  composeArguments,
  executeSetup,
  getInstance,
  listInstances,
  removeArguments,
  restoreArguments,
  setupArguments,
  validatePublicUrl,
  validateStoragePath,
  withPasswordFile,
} from "../src/instance/service.js";

const filesystem = { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile };

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-instance-"));
  const instancesDirectory = path.join(root, "instances");
  await mkdir(path.join(instancesDirectory, "alpha"), { recursive: true });
  await writeFile(
    path.join(instancesDirectory, "alpha", ".env"),
    [
      "MONGO_PORT=27017",
      "ISSUE_API_PORT=3100",
      "ISSUE_UI_PORT=4400",
      "BIAWS_PUBLIC_URL=https://alpha.example.test",
      "ISSUE_API_KEY=must-not-leak",
    ].join("\n"),
  );
  return {
    root,
    context: { repositoryRoot: root, instancesDirectory },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

function values(overrides = {}) {
  return {
    name: "beta",
    adminEmail: "admin@example.test",
    adminName: "Administrador",
    adminPassword: "private-password",
    mongoPort: 27018,
    apiPort: 3101,
    uiPort: 4401,
    publicUrl: "https://beta.example.test",
    storage: "volumes",
    demoSeed: false,
    disableRateLimit: false,
    apiRateLimitMax: 300,
    apiRateLimitWindow: 60,
    authRateLimitMax: 100,
    authRateLimitWindow: 10,
    apiKeyRateLimitMax: 1000,
    apiKeyRateLimitWindow: 3600,
    ...overrides,
  };
}

test("inventário e show expõem somente configuração não sensível", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const listed = await listInstances(setup.context, filesystem);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, "alpha");
  assert.equal(listed[0].publicUrl, "https://alpha.example.test");
  const shown = await getInstance(setup.context, filesystem, "alpha");
  assert.equal((await getInstance(setup.context, filesystem)).name, "alpha");
  const { env, ...safe } = shown;
  assert.equal(JSON.stringify(safe).includes("must-not-leak"), false);
  await assert.rejects(getInstance(setup.context, filesystem, "missing"), {
    code: "INSTANCE_NOT_FOUND",
    exitCode: 3,
  });
});

test("plano recusa colisões antes de executar Docker", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  await assert.rejects(
    buildSetupConfiguration(
      values({ apiPort: 3100 }),
      setup.context,
      filesystem,
    ),
    { code: "PORT_COLLISION", exitCode: 2 },
  );
});

test("valida URL e caminhos inseguros", () => {
  assert.equal(
    validatePublicUrl("https://biaws.example.test"),
    "https://biaws.example.test",
  );
  assert.throws(
    () => validatePublicUrl("https://user:pass@example.test/path"),
    {
      code: "INVALID_PUBLIC_URL",
    },
  );
  assert.throws(() => validateStoragePath("/", "Storage"), {
    code: "UNSAFE_STORAGE_PATH",
  });
  assert.throws(() => validateStoragePath("relative", "Storage"), {
    code: "UNSAFE_STORAGE_PATH",
  });
});

test("storage em diretórios é completo e mudanças são sinalizadas", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const storageRoot = path.join(setup.root, "data");
  const configuration = await buildSetupConfiguration(
    values({ name: "alpha", storage: "directories", storageRoot }),
    setup.context,
    filesystem,
  );
  assert.equal(configuration.mongoPath, path.join(storageRoot, "mongo"));
  assert.equal(configuration.storageChanged, true);
  assert.equal(
    setupArguments(configuration, setup.context).includes("--mongo-data-path"),
    true,
  );
});

test("setup passa password somente no ambiente redigido e nunca no argv", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const configuration = await buildSetupConfiguration(
    values(),
    setup.context,
    filesystem,
  );
  let invocation;
  const runner = {
    async run(command, args, options) {
      invocation = { command, args, options };
      return { processExitCode: 0, stdout: "", stderr: "" };
    },
  };
  const result = await executeSetup(configuration, setup.context, runner, {
    PATH: "/bin",
  });
  assert.equal(invocation.command, "bash");
  assert.equal(invocation.args.join(" ").includes("private-password"), false);
  assert.equal(
    invocation.options.env.BIAWS_BOOTSTRAP_ADMIN_PASSWORD,
    "private-password",
  );
  assert.deepEqual(invocation.options.secrets, ["private-password"]);
  assert.equal(invocation.options.silent, false);
  assert.equal(result.api, "http://127.0.0.1:3101");
});

test("argumentos Compose são determinísticos e injetáveis", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  assert.deepEqual(
    composeArguments(instance, setup.context, "start").slice(-3),
    ["up", "-d", "--wait"],
  );
  assert.equal(
    composeArguments(instance, setup.context, "status").at(-1),
    "json",
  );
});

test("backup, restore e remoção constroem argv separado e seguro", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  const passwordFile = path.join(setup.root, "password");
  const archive = path.join(setup.root, "alpha.tar.gz.enc");
  const backup = backupArguments(instance, setup.context, {
    output: archive,
    passwordFile,
  });
  assert.deepEqual(backup.slice(-4), [
    "--output",
    archive,
    "--password-file",
    passwordFile,
  ]);
  const restore = restoreArguments(instance, setup.context, {
    archive,
    passwordFile,
  });
  assert.equal(restore.includes("--yes"), true);
  assert.equal(restore.includes(archive), true);
  const remove = removeArguments(instance, setup.context, {
    deleteExternalData: false,
  });
  assert.equal(remove.includes("--delete-external-data"), false);
  assert.equal(remove.includes("--yes"), true);
});

test("senha temporária é privada e removida após a operação", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  let temporaryFile;
  const result = await withPasswordFile(
    filesystem,
    "long-private-password",
    "",
    async (passwordFile) => {
      temporaryFile = passwordFile;
      assert.equal(
        await readFile(passwordFile, "utf8"),
        "long-private-password\n",
      );
      return "ok";
    },
  );
  assert.equal(result, "ok");
  await assert.rejects(readFile(temporaryFile, "utf8"), { code: "ENOENT" });
  await assert.rejects(
    withPasswordFile(filesystem, "short", "", async () => undefined),
    { code: "WEAK_BACKUP_PASSWORD", exitCode: 2 },
  );
});
