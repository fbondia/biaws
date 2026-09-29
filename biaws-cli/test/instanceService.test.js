import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  backupArguments,
  buildSetupConfiguration,
  composeArguments,
  executeSetup,
  getInstance,
  getInstanceUpdateStatus,
  listInstances,
  removeArguments,
  restoreArguments,
  setupArguments,
  updateInstance,
  validateInstanceUpdate,
  validatePublicUrl,
  validateStoragePath,
  withPasswordFile,
} from "../src/instance/service.js";

const filesystem = { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile };
const release = {
  schemaVersion: 1,
  version: "1.2.0",
  deploymentRevision: 1,
  components: { "biaws-api": "0.6.0", "biaws-ui": "0.3.0", "biaws-monitor-executor": "0.1.0" },
};

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-instance-"));
  const instancesDirectory = path.join(root, "instances");
  await mkdir(path.join(instancesDirectory, "alpha"), { recursive: true });
  await mkdir(path.join(root, "biaws-cli"), { recursive: true });
  await writeFile(path.join(root, "biaws-cli", "package.json"), JSON.stringify({ version: "1.2.0" }));
  await writeFile(path.join(root, "release.json"), JSON.stringify(release));
  for (const [component, version] of Object.entries(release.components)) {
    await mkdir(path.join(root, component), { recursive: true });
    await writeFile(path.join(root, component, "package.json"), JSON.stringify({ version }));
  }
  await writeFile(
    path.join(instancesDirectory, "alpha", ".env"),
    [
      "MONGO_PORT=27017",
      "BIAWS_API_PORT=3100",
      "BIAWS_UI_PORT=4400",
      "BIAWS_PUBLIC_URL=https://alpha.example.test",
      "BIAWS_API_KEY=must-not-leak",
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
  await assert.rejects(buildSetupConfiguration(values({ apiPort: 3100 }), setup.context, filesystem), {
    code: "PORT_COLLISION",
    exitCode: 2,
  });
});

test("valida URL e caminhos inseguros", () => {
  assert.equal(validatePublicUrl("https://biaws.example.test"), "https://biaws.example.test");
  assert.throws(() => validatePublicUrl("https://user:pass@example.test/path"), {
    code: "INVALID_PUBLIC_URL",
  });
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
  assert.equal(setupArguments(configuration, setup.context).includes("--mongo-data-path"), true);
});

test("setup passa password somente no ambiente redigido e nunca no argv", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const configuration = await buildSetupConfiguration(values(), setup.context, filesystem);
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
  assert.equal(invocation.options.env.BIAWS_BOOTSTRAP_ADMIN_PASSWORD, "private-password");
  assert.deepEqual(invocation.options.secrets, ["private-password"]);
  assert.equal(invocation.options.silent, false);
  assert.equal(result.api, "http://127.0.0.1:3101");
});

test("argumentos Compose são determinísticos e injetáveis", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  assert.deepEqual(composeArguments(instance, setup.context, "start").slice(-3), ["up", "-d", "--wait"]);
  assert.equal(composeArguments(instance, setup.context, "status").at(-1), "json");
  assert.deepEqual(composeArguments(instance, setup.context, "update").slice(-4), ["up", "-d", "--build", "--wait"]);
  assert.deepEqual(composeArguments(instance, setup.context, "validate").slice(-2), ["config", "--quiet"]);
});

test("status de update compara a versão implantada com a release", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  let status = await getInstanceUpdateStatus(instance, setup.context, filesystem);
  assert.equal(status.currentVersion, "unknown");
  assert.equal(status.newVersion, "1.2.0");
  assert.equal(status.legacyInstallation, true);
  assert.equal(status.updateRequired, true);
  await writeFile(instance.envFile, "BIAWS_VERSION=1.2.0\n");
  const current = await getInstance(setup.context, filesystem, "alpha");
  // A versão antiga igual não substitui o manifesto aplicado.
  status = await getInstanceUpdateStatus(current, setup.context, filesystem);
  assert.equal(status.updateRequired, true);
  await writeFile(path.join(path.dirname(instance.envFile), "release.json"), JSON.stringify(release));
  status = await getInstanceUpdateStatus(current, setup.context, filesystem);
  assert.equal(status.updateRequired, false);
  assert.deepEqual(status.differences, []);
});

test("update valida o Compose e grava a versão somente após o deploy", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  const invocations = [];
  const runner = {
    async run(command, args, options) {
      invocations.push({ argv: [command, ...args], options });
      return { processExitCode: 0, stdout: "", stderr: "" };
    },
  };
  await validateInstanceUpdate(instance, setup.context, runner);
  await updateInstance(instance, setup.context, filesystem, runner, release, {
    PATH: "/bin",
  });
  assert.deepEqual(
    invocations.map((invocation) => invocation.argv.slice(-2)),
    [
      ["config", "--quiet"],
      ["--all", "--services"],
      ["--build", "--wait"],
    ],
  );
  assert.equal(invocations[2].options.env.BIAWS_VERSION, "1.2.0");
  assert.deepEqual(
    JSON.parse(await readFile(path.join(path.dirname(instance.envFile), "release.json"), "utf8")),
    release,
  );
  assert.match(await readFile(instance.envFile, "utf8"), /^BIAWS_VERSION=1\.2\.0$/mu);
});

test("update não altera a versão persistida quando o deploy falha", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  const before = await readFile(instance.envFile, "utf8");
  const runner = {
    async run() {
      throw new Error("deploy failed");
    },
  };
  await assert.rejects(updateInstance(instance, setup.context, filesystem, runner, release), /deploy failed/u);
  assert.equal(await readFile(instance.envFile, "utf8"), before);
  await assert.rejects(readFile(path.join(path.dirname(instance.envFile), "release.json")), { code: "ENOENT" });
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
  assert.deepEqual(backup.slice(-4), ["--output", archive, "--password-file", passwordFile]);
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
  const result = await withPasswordFile(filesystem, "long-private-password", "", async (passwordFile) => {
    temporaryFile = passwordFile;
    assert.equal(await readFile(passwordFile, "utf8"), "long-private-password\n");
    return "ok";
  });
  assert.equal(result, "ok");
  await assert.rejects(readFile(temporaryFile, "utf8"), { code: "ENOENT" });
  await assert.rejects(
    withPasswordFile(filesystem, "short", "", async () => undefined),
    { code: "WEAK_BACKUP_PASSWORD", exitCode: 2 },
  );
});

for (const field of ["biaws-api", "biaws-ui", "biaws-monitor-executor", "deploymentRevision", "version"]) {
  test(`update detecta alteração isolada de ${field}`, async (t) => {
    const setup = await fixture();
    t.after(setup.cleanup);
    const instance = await getInstance(setup.context, filesystem, "alpha");
    const previous = structuredClone(release);
    if (field === "deploymentRevision") previous[field] = 2;
    else if (field === "version") previous[field] = "1.1.0";
    else previous.components[field] = "0.0.1";
    await writeFile(instance.envFile, `BIAWS_VERSION=${previous.version}\n`);
    await writeFile(path.join(path.dirname(instance.envFile), "release.json"), JSON.stringify(previous));
    const current = await getInstance(setup.context, filesystem, "alpha");
    const status = await getInstanceUpdateStatus(current, setup.context, filesystem);
    assert.equal(status.updateRequired, true);
    assert.equal(status.legacyInstallation, false);
    assert.deepEqual(
      status.differences.map((change) => change.field),
      [field],
    );
  });
}

test("manifesto inválido ou divergente bloqueia a atualização antes do Docker", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  const manifestPath = path.join(setup.root, "release.json");
  for (const contents of [
    "{",
    JSON.stringify({ ...release, schemaVersion: 2 }),
    JSON.stringify({ ...release, components: {} }),
  ]) {
    await writeFile(manifestPath, contents);
    await assert.rejects(getInstanceUpdateStatus(instance, setup.context, filesystem), {
      code: "INVALID_RELEASE_MANIFEST",
    });
  }
  await writeFile(manifestPath, JSON.stringify(release));
  await writeFile(path.join(setup.root, "biaws-api", "package.json"), '{"version":"0.7.0"}');
  await assert.rejects(getInstanceUpdateStatus(instance, setup.context, filesystem), /release.json diverge/u);
});

test("manifesto aplicado corrompido não é tratado como instalação legada", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  await writeFile(path.join(path.dirname(instance.envFile), "release.json"), "{");
  await assert.rejects(getInstanceUpdateStatus(instance, setup.context, filesystem), {
    code: "INVALID_RELEASE_MANIFEST",
  });
});

test("falha de deploy preserva manifesto anterior e update inclui executor existente", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  const before = { ...release, deploymentRevision: 2 };
  const statePath = path.join(path.dirname(instance.envFile), "release.json");
  await writeFile(statePath, JSON.stringify(before));
  let deployment = false;
  const runner = {
    async run(command, args) {
      if (args.includes("ps")) return { stdout: "mongo\napi\nui\nmonitor-executor\n" };
      assert.deepEqual(args.slice(-4), ["mongo", "api", "ui", "monitor-executor"]);
      deployment = true;
      throw new Error("unhealthy");
    },
  };
  await assert.rejects(updateInstance(instance, setup.context, filesystem, runner, release), /unhealthy/u);
  assert.equal(deployment, true);
  assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), before);
});

test("mudança de release após check impede implantar snapshot obsoleto", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  await writeFile(path.join(setup.root, "release.json"), JSON.stringify({ ...release, deploymentRevision: 2 }));
  await assert.rejects(
    updateInstance(
      instance,
      setup.context,
      filesystem,
      {
        run() {
          assert.fail("não deve chamar Docker");
        },
      },
      release,
    ),
    { code: "RELEASE_CHANGED" },
  );
});

test("CLI e MCP independentes não alteram a release; ordem das chaves é irrelevante", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  const applied = { ...release, components: Object.fromEntries(Object.entries(release.components).reverse()) };
  await writeFile(path.join(path.dirname(instance.envFile), "release.json"), JSON.stringify(applied));
  await writeFile(instance.envFile, "BIAWS_VERSION=1.2.0\n");
  await writeFile(path.join(setup.root, "biaws-cli", "package.json"), '{"version":"9.0.0"}');
  await mkdir(path.join(setup.root, "biaws-mcp"));
  await writeFile(path.join(setup.root, "biaws-mcp", "package.json"), '{"version":"9.0.0"}');
  const current = await getInstance(setup.context, filesystem, "alpha");
  assert.equal((await getInstanceUpdateStatus(current, setup.context, filesystem)).updateRequired, false);
});

test("update --check é somente leitura; manifesto igual evita deploy e --force o executa", async (t) => {
  const { default: InstanceUpdate } = await import("../src/commands/instance/update.js");
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  let calls = 0;
  let result;
  const command = new InstanceUpdate(
    [],
    { bin: "biaws" },
    {
      filesystem,
      processRunner: {
        async run() {
          calls++;
          return { stdout: "" };
        },
      },
      environment: {},
    },
  );
  command.localContext = async () => setup.context;
  command.output = () => ({
    result(value) {
      result = value;
    },
  });
  command.parse = async () => ({ args: { instance: "alpha" }, flags: { check: true, json: true } });
  await command.run();
  assert.equal(result.legacyInstallation, true);
  assert.equal(calls, 0);
  await assert.rejects(readFile(path.join(path.dirname(instance.envFile), "release.json")), { code: "ENOENT" });
  await writeFile(path.join(path.dirname(instance.envFile), "release.json"), JSON.stringify(release));
  await writeFile(instance.envFile, "BIAWS_VERSION=1.2.0\n");
  command.parse = async () => ({ args: { instance: "alpha" }, flags: { json: true } });
  await command.run();
  assert.equal(result.updated, false);
  assert.equal(calls, 0);
  command.parse = async () => ({
    args: { instance: "alpha" },
    flags: { force: true, "skip-backup": true, json: true },
  });
  await command.run();
  assert.equal(result.updated, true);
  assert.equal(calls, 3);
});

test("release alterada durante deploy não é registrada como aplicada", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  const before = await readFile(instance.envFile, "utf8");
  const runner = {
    async run(command, args) {
      if (args.includes("up")) {
        await writeFile(path.join(setup.root, "release.json"), JSON.stringify({ ...release, deploymentRevision: 2 }));
      }
      return { stdout: "" };
    },
  };
  await assert.rejects(updateInstance(instance, setup.context, filesystem, runner, release), {
    code: "RELEASE_CHANGED",
  });
  assert.equal(await readFile(instance.envFile, "utf8"), before);
  await assert.rejects(readFile(path.join(path.dirname(instance.envFile), "release.json")), { code: "ENOENT" });
});

test("falha de persistência mantém snapshot anterior íntegro e permite nova tentativa", async (t) => {
  const setup = await fixture();
  t.after(setup.cleanup);
  const instance = await getInstance(setup.context, filesystem, "alpha");
  const statePath = path.join(path.dirname(instance.envFile), "release.json");
  const previous = { ...release, deploymentRevision: 2 };
  await writeFile(statePath, JSON.stringify(previous));
  const failingFilesystem = {
    ...filesystem,
    async rename(source, destination) {
      if (destination === statePath) throw new Error("disk failure");
      return rename(source, destination);
    },
  };
  await assert.rejects(
    updateInstance(
      instance,
      setup.context,
      failingFilesystem,
      {
        async run() {
          return { stdout: "" };
        },
      },
      release,
    ),
    /disk failure/u,
  );
  assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), previous);
  assert.equal(
    (await readdir(path.dirname(instance.envFile))).some((file) => file.endsWith(".tmp")),
    false,
  );
  const current = await getInstance(setup.context, filesystem, "alpha");
  assert.equal((await getInstanceUpdateStatus(current, setup.context, filesystem)).updateRequired, true);
});
