import { errorCode, errorMessage } from "../../src/helpers/error.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeResourceIdentifier,
  requireReplicationIdentifier,
} from "../../src/helpers/resourceIdentifier.js";

test("resource identifiers follow the editable catalog key format", () => {
  assert.equal(normalizeResourceIdentifier(" Shared-Policy "), "shared-policy");
  assert.equal(normalizeResourceIdentifier("", "existing-key"), null);
  assert.equal(
    normalizeResourceIdentifier(undefined, "existing-key"),
    "existing-key",
  );
  assert.throws(
    () => normalizeResourceIdentifier("invalid_key"),
    (error) => errorCode(error) === "INVALID_RESOURCE_IDENTIFIER",
  );
});

test("replication requires an identifier without making it mandatory to save", () => {
  assert.equal(
    requireReplicationIdentifier({ identifier: "shared-policy" }, "documento"),
    "shared-policy",
  );
  assert.throws(
    () => requireReplicationIdentifier({ identifier: null }, "documento"),
    (error) =>
      errorCode(error) === "REPLICATION_IDENTIFIER_REQUIRED" &&
      errorMessage(error) ===
        "Defina um identificador no documento antes de replicá-lo",
  );
});
