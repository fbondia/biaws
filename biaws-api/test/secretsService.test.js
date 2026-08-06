import assert from "node:assert/strict";
import test from "node:test";

import {
  createSecret,
  normalizeSecretFile,
  updateSecret,
} from "../src/services/secretsService.js";

const actor = {
  workspaceId: "workspace-a",
  permissionScopes: {
    "secrets.create": { workspace: true, applicationIds: [] },
    "secrets.value.write": { workspace: true, applicationIds: [] },
  },
};

test("secret creation rejects unknown fields before storing a value", async () => {
  await assert.rejects(
    createSecret(
      {
        name: "Example",
        value: "private-value",
        unexpected: true,
      },
      actor,
    ),
    { code: "INVALID_SECRET" },
  );
});

test("metadata updates cannot smuggle a new secret value", async () => {
  await assert.rejects(
    updateSecret("secret-a", { value: "private-value" }, actor),
    { code: "INVALID_SECRET" },
  );
});

test("secret identifiers cannot be changed after creation", async () => {
  await assert.rejects(
    updateSecret("secret-a", { identifier: "replacement" }, actor),
    { code: "INVALID_SECRET" },
  );
});

test("secret file metadata is normalized without exposing its content", () => {
  assert.deepEqual(
    normalizeSecretFile({
      originalname: "keys\\deploy.pem",
      mimetype: "application/x-pem-file",
      buffer: Buffer.from("private-key"),
    }),
    {
      kind: "file",
      fileName: "deploy.pem",
      mediaType: "application/x-pem-file",
      size: 11,
    },
  );
});

test("empty secret files are rejected", () => {
  assert.throws(
    () =>
      normalizeSecretFile({
        originalname: "empty.env",
        mimetype: "text/plain",
        buffer: Buffer.alloc(0),
      }),
    { code: "INVALID_SECRET_FILE", statusCode: 422 },
  );
});

test("secret file names cannot inject response headers", () => {
  assert.throws(
    () =>
      normalizeSecretFile({
        originalname: "key.pem\r\nX-Injected: true",
        mimetype: "application/octet-stream",
        buffer: Buffer.from("key"),
      }),
    { code: "INVALID_SECRET_FILE", statusCode: 422 },
  );
});
