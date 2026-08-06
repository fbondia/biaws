import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSecretIdentifier,
  normalizeSecretPayload,
  publicSecret,
} from "../src/repositories/secretsRepository.js";

test("secret metadata validation accepts supported values", () => {
  assert.deepEqual(
    normalizeSecretPayload({
      identifier: " GitHub.Token-Production ",
      name: " GitHub Produção ",
      description: "Token do deploy",
      type: "token",
      environment: "production",
    }),
    {
      identifier: "github.token-production",
      name: "GitHub Produção",
      normalizedName: "github produção",
      description: "Token do deploy",
      type: "token",
      environment: "production",
    },
  );
});

test("secret identifiers are normalized and reject ambiguous values", () => {
  assert.equal(normalizeSecretIdentifier(" Deploy_Key.01 "), "deploy_key.01");
  assert.throws(() => normalizeSecretIdentifier("a"), {
    code: "INVALID_SECRET_IDENTIFIER",
  });
  assert.throws(() => normalizeSecretIdentifier("deploy key"), {
    code: "INVALID_SECRET_IDENTIFIER",
  });
});

test("public secret never exposes locators or encrypted version data", () => {
  const result = publicSecret({
    id: "secret-a",
    workspaceId: "workspace-a",
    applicationId: null,
    name: "Example",
    description: "",
    type: "generic",
    environment: "",
    provider: "local",
    status: "active",
    currentVersion: 1,
    contentKind: "file",
    versions: [
      {
        version: 1,
        locator: "secret-a/version-1.enc",
        kind: "file",
        fileName: "production.env",
        mediaType: "text/plain",
        size: 42,
      },
    ],
  });

  assert.equal(result.versionCount, 1);
  assert.equal(result.identifier, "secret-a");
  assert.equal(result.contentKind, "file");
  assert.deepEqual(result.file, {
    name: "production.env",
    mediaType: "text/plain",
    size: 42,
  });
  assert.equal(Object.hasOwn(result, "versions"), false);
  assert.equal(Object.hasOwn(result, "locator"), false);
});

test("legacy secrets are exposed as text content", () => {
  const result = publicSecret({
    id: "secret-a",
    workspaceId: "workspace-a",
    name: "Legacy",
    type: "generic",
    provider: "local",
    status: "active",
    currentVersion: 1,
    versions: [{ version: 1, locator: "secret-a/version-1.enc" }],
  });

  assert.equal(result.contentKind, "text");
  assert.equal(result.file, null);
  assert.equal(result.provisioningStatus, "ready");
});

test("pending secret metadata exposes no provider or version", () => {
  const result = publicSecret({
    id: "secret-pending",
    workspaceId: "workspace-a",
    identifier: "pending-secret",
    name: "Pending",
    type: "token",
    provider: null,
    status: "active",
    provisioningStatus: "pending",
    currentVersion: 0,
    contentKind: "file",
    versions: [],
  });

  assert.equal(result.provisioningStatus, "pending");
  assert.equal(result.currentVersion, 0);
  assert.equal(result.versionCount, 0);
  assert.equal(result.provider, null);
  assert.equal(result.file, null);
});
