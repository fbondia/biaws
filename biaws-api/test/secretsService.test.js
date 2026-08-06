import assert from "node:assert/strict";
import test from "node:test";

import { createSecret, updateSecret } from "../src/services/secretsService.js";

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
