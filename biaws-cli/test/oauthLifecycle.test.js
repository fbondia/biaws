import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import test from "node:test";

const repository = fileURLToPath(new URL("../../", import.meta.url));
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "biaws-oauth-lifecycle-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  for (const folder of ["bin", "scripts", "instances/review"])
    await fs.mkdir(path.join(dir, folder), { recursive: true });
  await fs.copyFile(path.join(repository, "scripts/bootstrap.sh"), path.join(dir, "scripts/bootstrap.sh"));
  await fs.writeFile(path.join(dir, "scripts/check-prerequisites.sh"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  const log = path.join(dir, "calls.jsonl");
  const docker = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify(args)+'\\n');
if(args.includes('ps')) console.log('mongo\\napi\\nui\\nmcp');
if(args.includes('bootstrap:agent')) console.log('BIAWS_AGENT_API_KEY=synthetic\\nBIAWS_AGENT_WORKSPACE_ID=workspace');
if(args.includes('bootstrap:monitor-executor')) console.log('BIAWS_MONITOR_EXECUTOR_API_KEY=synthetic\\nBIAWS_MONITOR_EXECUTOR_WORKSPACE_ID=workspace');
if(args.includes('mongorestore')) process.stdin.resume();
`;
  await fs.writeFile(path.join(dir, "bin/docker"), docker, { mode: 0o700 });
  await fs.writeFile(path.join(dir, "bin/curl"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  const envFile = path.join(dir, "instances/review/.env");
  const env = {
    ...process.env,
    PATH: path.join(dir, "bin") + path.delimiter + process.env.PATH,
    BIAWS_INSTANCES_DIR: path.join(dir, "instances"),
    TEST_CALLS: log,
    BIAWS_SKIP_DEMO_SEED: "1",
  };
  return {
    dir,
    log,
    envFile,
    env,
    calls: async () => (await fs.readFile(log, "utf8")).trim().split("\n").map(JSON.parse),
  };
}

for (const enabled of [true, false]) {
  test(`bootstrap reconciles an existing MCP container when enabled=${enabled}`, async (t) => {
    const f = await fixture(t);
    await fs.writeFile(
      f.envFile,
      `BETTER_AUTH_SECRET=synthetic\nBIAWS_MCP_CONFIGURED=true\nBIAWS_MCP_HTTP_ENABLED=${enabled}\n`,
    );
    const result = spawnSync("bash", [path.join(f.dir, "scripts/bootstrap.sh"), "--instance", "review"], {
      env: f.env,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const calls = await f.calls();
    assert.equal(
      calls.some((args) => args.includes("stop") && args.at(-1) === "mcp"),
      !enabled,
    );
    const up = calls.find((args) => args.includes("up"));
    assert.equal(up.includes("mcp"), enabled);
    if (!enabled) assert.ok(calls.findIndex((args) => args.includes("stop")) < calls.indexOf(up));
  });
}

for (const sameOrigin of [true, false]) {
  test(`restore removes destination OAuth state absent from a legacy backup (sameOrigin=${sameOrigin})`, async (t) => {
    const f = await fixture(t);
    const instance = path.dirname(f.envFile);
    const master = path.join(instance, "master");
    const targetOrigin = "https://target.example.test";
    await fs.writeFile(master, Buffer.alloc(32, 1));
    await fs.writeFile(f.envFile, `BIAWS_PUBLIC_URL=${targetOrigin}\nBIAWS_SECRETS_KEY_PATH=${master}\n`);
    const payload = path.join(f.dir, "payload/biaws-instance-backup");
    await fs.mkdir(path.join(payload, "instance"), { recursive: true });
    await fs.mkdir(path.join(payload, "files"));
    const emptyTar = path.join(f.dir, "empty.tar");
    assert.equal(spawnSync("tar", ["-cf", emptyTar, "-T", "/dev/null"]).status, 0);
    for (const name of ["issues", "requests", "documents", "secrets"])
      await fs.copyFile(emptyTar, path.join(payload, "files", name + ".tar"));
    await fs.writeFile(path.join(payload, "manifest"), "format_version=1\nmongo_database=biaws\n");
    await fs.writeFile(
      path.join(payload, "instance/environment.env"),
      `BIAWS_PUBLIC_URL=${sameOrigin ? targetOrigin : "https://source.example.test"}\n`,
    );
    await fs.writeFile(path.join(payload, "instance/secrets-master-key"), Buffer.alloc(32, 2));
    await fs.writeFile(path.join(payload, "mongo.archive.gz"), "legacy-archive-without-oauth");
    const plain = path.join(f.dir, "plain.tgz"),
      archive = path.join(f.dir, "backup.enc"),
      password = path.join(f.dir, "password");
    assert.equal(spawnSync("tar", ["-C", path.dirname(payload), "-czf", plain, "biaws-instance-backup"]).status, 0);
    await fs.writeFile(password, "Synthetic-backup-password-42\n", { mode: 0o600 });
    const encrypted = spawnSync(
      process.execPath,
      [
        path.join(repository, "scripts/instance-archive-crypto.mjs"),
        "encrypt",
        "--input",
        plain,
        "--output",
        archive,
        "--password-file",
        password,
        "--iterations",
        "600000",
      ],
      { encoding: "utf8" },
    );
    assert.equal(encrypted.status, 0, encrypted.stderr);
    await fs.writeFile(
      archive + ".sha256",
      createHash("sha256")
        .update(await fs.readFile(archive))
        .digest("hex") + "  backup.enc\n",
    );
    const result = spawnSync(
      "bash",
      [
        path.join(repository, "scripts/restore-instance.sh"),
        "--instance",
        "review",
        "--instances-dir",
        path.dirname(instance),
        "--archive",
        archive,
        "--password-file",
        password,
        "--yes",
      ],
      { env: f.env, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const calls = await f.calls();
    const restoreIndex = calls.findIndex((args) => args.includes("mongorestore"));
    const invalidations = calls.map((args, index) => ({ args, index })).filter(({ args }) => args.includes("mongosh"));
    assert.equal(invalidations.length, sameOrigin ? 1 : 2);
    assert.ok(invalidations[0].index < restoreIndex);
    assert.match(invalidations[0].args.at(-1), /oauthGrants.*oauthDelegations.*jwks/u);
    if (!sameOrigin) assert.ok(invalidations[1].index > restoreIndex);
  });
}
