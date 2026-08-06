import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSecretPayload,
  publicSecret,
} from "../src/repositories/secretsRepository.js";

test("secret metadata validation accepts supported values", () => {
  assert.deepEqual(
    normalizeSecretPayload({
      name: " GitHub Produção ",
      description: "Token do deploy",
      type: "token",
      environment: "production",
    }),
    {
      name: "GitHub Produção",
      normalizedName: "github produção",
      description: "Token do deploy",
      type: "token",
      environment: "production",
    },
  );
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
    versions: [{ version: 1, locator: "secret-a/version-1.enc" }],
  });

  assert.equal(result.versionCount, 1);
  assert.equal(Object.hasOwn(result, "versions"), false);
  assert.equal(Object.hasOwn(result, "locator"), false);
});
