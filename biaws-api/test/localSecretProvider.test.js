import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalSecretProvider } from "../src/secrets/localSecretProvider.js";

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "biaws-secrets-"));
  const keyFile = path.join(directory, "master.key");
  const vaultDirectory = path.join(directory, "vault");
  await writeFile(keyFile, randomBytes(32), { mode: 0o600 });
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    provider: new LocalSecretProvider({
      directory: vaultDirectory,
      keyFile,
    }),
    vaultDirectory,
  };
}

const context = {
  workspaceId: "workspace-a",
  secretId: "secret-a",
  version: 1,
};

test("local provider encrypts one file per version and recovers the value", async (t) => {
  const { provider, vaultDirectory } = await fixture(t);
  const stored = await provider.putValue(context, "extremely-private-value");

  assert.equal(stored.locator, "secret-a/version-1.enc");
  const contents = await readFile(
    path.join(vaultDirectory, stored.locator),
    "utf8",
  );
  assert.doesNotMatch(contents, /extremely-private-value/u);
  assert.equal(
    await provider.getValue(context, stored.locator),
    "extremely-private-value",
  );
});

test("local provider preserves arbitrary encrypted binary content", async (t) => {
  const { provider, vaultDirectory } = await fixture(t);
  const content = Buffer.from([0x00, 0xff, 0x10, 0x80, 0x0a]);
  const stored = await provider.putContent(context, content);

  const encrypted = await readFile(path.join(vaultDirectory, stored.locator));
  assert.equal(encrypted.includes(content), false);
  assert.deepEqual(await provider.getContent(context, stored.locator), content);
});

test("local provider enforces the configured binary content limit", async (t) => {
  const { vaultDirectory } = await fixture(t);
  const directory = path.dirname(vaultDirectory);
  const provider = new LocalSecretProvider({
    directory: vaultDirectory,
    keyFile: path.join(directory, "master.key"),
    maxBytes: 4,
  });

  await assert.rejects(
    provider.putContent(context, Buffer.from([1, 2, 3, 4, 5])),
    { code: "INVALID_SECRET_VALUE", statusCode: 422 },
  );
});

test("authenticated context prevents moving a secret between workspaces", async (t) => {
  const { provider } = await fixture(t);
  const stored = await provider.putValue(context, "private-value");

  await assert.rejects(
    provider.getValue(
      { ...context, workspaceId: "workspace-b" },
      stored.locator,
    ),
    { code: "SECRET_DECRYPTION_FAILED" },
  );
});

test("an existing version is never overwritten", async (t) => {
  const { provider } = await fixture(t);
  const stored = await provider.putValue(context, "first-value");

  await assert.rejects(provider.putValue(context, "second-value"), {
    code: "SECRET_VERSION_CONFLICT",
  });
  assert.equal(await provider.getValue(context, stored.locator), "first-value");
});

test("local provider rejects invalid keys and locators", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "biaws-secrets-key-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const keyFile = path.join(directory, "short.key");
  await writeFile(keyFile, "not-a-32-byte-key", { mode: 0o600 });
  const provider = new LocalSecretProvider({
    directory: path.join(directory, "vault"),
    keyFile,
  });

  await assert.rejects(provider.putValue(context, "value"), {
    code: "INVALID_SECRETS_MASTER_KEY",
  });
  assert.throws(() => provider.resolveLocator("../../outside"), {
    code: "INVALID_SECRET_LOCATOR",
  });
});
