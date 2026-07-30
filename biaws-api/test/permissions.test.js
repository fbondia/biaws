import assert from "node:assert/strict";
import test from "node:test";

import {
  assertKnownPermissions,
  isKnownPermission,
  PERMISSION_CATALOG,
  PERMISSIONS,
} from "../../shared/permissions.js";

test("permission catalog has unique stable ids and complete UI metadata", () => {
  const ids = PERMISSION_CATALOG.map(({ id }) => id);

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length > 0);
  for (const permission of PERMISSION_CATALOG) {
    assert.match(permission.id, /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u);
    assert.ok(permission.domain);
    assert.ok(permission.label);
    assert.ok(permission.description);
    assert.equal(Object.isFrozen(permission), true);
  }
  assert.equal(Object.isFrozen(PERMISSION_CATALOG), true);
});

test("permission constants and validation use the canonical catalog", () => {
  assert.equal(PERMISSIONS.ISSUES_IMPORT_EML, "issues.import.eml");
  assert.equal(
    PERMISSIONS.PROCEDURES_ATTACHMENT_READ,
    "procedures.attachment.read",
  );
  assert.equal(isKnownPermission(PERMISSIONS.SKILLS_PUBLISH), true);
  assert.equal(isKnownPermission("issues.superuser"), false);
  assert.doesNotThrow(() =>
    assertKnownPermissions([PERMISSIONS.ISSUES_READ, PERMISSIONS.DEMANDS_READ]),
  );
  assert.throws(
    () => assertKnownPermissions(["issues.read", "issues.superuser"]),
    /Unknown permissions: issues\.superuser/u,
  );
});
