import assert from "node:assert/strict";
import test from "node:test";

import {
  canActOnSecret,
  formatSecretBytes,
  permissionApplicationIds,
  suggestSecretIdentifier,
} from "../src/components/secrets/SecretsView/model.js";

test("secret identifiers are suggested from human-readable names", () => {
  assert.equal(
    suggestSecretIdentifier(" Chave de Produção / GitHub "),
    "chave-de-producao-github",
  );
});

test("secret presentation helpers format sizes and permission scopes", () => {
  const actor = {
    permissionScopes: {
      "secrets.update": { workspace: false, applicationIds: ["app-a"] },
      "secrets.value.write": {
        workspace: false,
        applicationIds: ["app-a", "app-b"],
      },
    },
  };

  assert.equal(formatSecretBytes(1536), "1.5 KiB");
  assert.deepEqual(
    permissionApplicationIds(actor, "secrets.update", "secrets.value.write"),
    ["app-a", "app-b"],
  );
  assert.equal(
    canActOnSecret(actor, "secrets.update", { applicationId: "app-a" }),
    true,
  );
  assert.equal(
    canActOnSecret(actor, "secrets.update", { applicationId: "app-b" }),
    false,
  );
});
