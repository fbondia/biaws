import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createReferenceResolver } from "../src/referenceResolver.js";

test("reference resolver reads allowlisted environment and file secrets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-monitor-secrets-"));
  await writeFile(path.join(root, "service-auth"), "Bearer file-secret\n", {
    mode: 0o600,
  });
  const resolve = createReferenceResolver(
    {
      environment: { "legacy-auth": "SERVICE_AUTH" },
      files: { "service-auth": "service-auth" },
      fileRoot: root,
    },
    { env: { SERVICE_AUTH: "Bearer environment-secret" } },
  );

  assert.equal(await resolve("legacy-auth"), "Bearer environment-secret");
  assert.equal(await resolve("service-auth"), "Bearer file-secret");
});

test("reference resolver rejects unknown, duplicate and escaping sources", async () => {
  assert.throws(
    () =>
      createReferenceResolver({
        environment: { duplicate: "SECRET" },
        files: { duplicate: "secret" },
      }),
    /cannot use environment and file sources/u,
  );
  assert.throws(
    () =>
      createReferenceResolver({
        files: { forbidden: "executor-api-key" },
      }),
    /invalid entry/u,
  );
  const parent = await mkdtemp(path.join(os.tmpdir(), "biaws-monitor-root-"));
  const root = path.join(parent, "secrets");
  await mkdir(root);
  await writeFile(path.join(parent, "outside"), "sensitive");
  await symlink(path.join(parent, "outside"), path.join(root, "escaped"));
  const resolve = createReferenceResolver({
    files: { escaped: "escaped" },
    fileRoot: root,
  });

  await assert.rejects(resolve("unknown"), { code: "REFERENCE_NOT_ALLOWED" });
  await assert.rejects(resolve("escaped"), {
    code: "REFERENCE_NOT_AVAILABLE",
  });
});
