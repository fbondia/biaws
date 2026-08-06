import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEffectivePermissions,
  calculatePermissionScopes,
  INITIAL_PERMISSION_GROUPS,
  normalizeGroupInput,
} from "../src/repositories/accessRepository.js";
import { PERMISSION_CATALOG } from "../../shared/index.js";

test("initial groups use only canonical permissions", () => {
  const known = new Set(PERMISSION_CATALOG.map(({ id }) => id));
  assert.equal(INITIAL_PERMISSION_GROUPS.length, 7);
  for (const group of INITIAL_PERMISSION_GROUPS) {
    assert.ok(group.permissions.length > 0);
    assert.ok(group.permissions.every((permission) => known.has(permission)));
  }
});

test("administration initial group contains every permission", () => {
  const administration = INITIAL_PERMISSION_GROUPS.find(
    ({ id }) => id === "administration",
  );
  assert.deepEqual(
    [...administration.permissions].sort(),
    PERMISSION_CATALOG.map(({ id }) => id).sort(),
  );
});

test("agent operator excludes administrative and catalog publication permissions", () => {
  const agent = INITIAL_PERMISSION_GROUPS.find(
    ({ id }) => id === "agent-operator",
  );
  assert.ok(agent.permissions.includes("skills.read"));
  assert.ok(agent.permissions.includes("issues.create"));
  assert.ok(agent.permissions.includes("issues.attachment.read"));
  assert.ok(agent.permissions.includes("demands.attachment.read"));
  assert.ok(agent.permissions.includes("tasks.attachment.read"));
  assert.ok(agent.permissions.includes("procedures.attachment.read"));
  assert.ok(agent.permissions.includes("taxonomy.manage"));
  assert.ok(
    !agent.permissions.some((permission) => permission.startsWith("secrets.")),
  );
  assert.ok(
    agent.permissions.every(
      (permission) =>
        !["users.", "roles.", "api_keys.", "audit."].some((prefix) =>
          permission.startsWith(prefix),
        ),
    ),
  );
  assert.ok(
    !agent.permissions.some(
      (permission) =>
        permission.endsWith(".archive") ||
        ["skills.publish", "skills.deprecate"].includes(permission),
    ),
  );
});

test("multiple groups produce a unique permission union and ignore inactive groups", () => {
  assert.deepEqual(
    calculateEffectivePermissions([
      { active: true, permissions: ["issues.read", "issues.status.update"] },
      { active: true, permissions: ["issues.read", "demands.read"] },
      { active: false, permissions: ["roles.manage"] },
    ]),
    ["demands.read", "issues.read", "issues.status.update"],
  );
});

test("group input rejects permissions outside the catalog", () => {
  assert.throws(
    () =>
      normalizeGroupInput({
        name: "Inválido",
        permissions: ["issues.read", "root.everything"],
      }),
    /Unknown permissions: root\.everything/u,
  );
});

test("application scope accepts domain permissions and rejects workspace permissions", () => {
  const group = normalizeGroupInput({
    name: "Billing support",
    permissions: ["issues.read", "procedures.read"],
    scope: {
      type: "applications",
      applicationIds: ["billing", "billing", "ledger"],
    },
  });
  assert.deepEqual(group.scope, {
    type: "applications",
    applicationIds: ["billing", "ledger"],
  });
  assert.throws(
    () =>
      normalizeGroupInput({
        name: "Invalid scoped administration",
        permissions: ["issues.read", "servers.read"],
        scope: { type: "applications", applicationIds: ["billing"] },
      }),
    /Workspace permissions cannot be application-scoped/u,
  );
});

test("secret permissions support workspace or application scope", () => {
  const group = normalizeGroupInput({
    name: "Segredos de billing",
    permissions: ["secrets.metadata.read", "secrets.value.write"],
    scope: { type: "applications", applicationIds: ["billing"] },
  });
  assert.deepEqual(group.scope, {
    type: "applications",
    applicationIds: ["billing"],
  });
});

test("permission scopes preserve independent application grants", () => {
  assert.deepEqual(
    calculatePermissionScopes([
      {
        active: true,
        permissions: ["issues.read", "issues.update"],
        scope: { type: "applications", applicationIds: ["app-a"] },
      },
      {
        active: true,
        permissions: ["issues.read"],
        scope: { type: "applications", applicationIds: ["app-b"] },
      },
      {
        active: true,
        permissions: ["procedures.read"],
        scope: { type: "workspace", applicationIds: [] },
      },
    ]),
    {
      "issues.read": {
        workspace: false,
        applicationIds: ["app-a", "app-b"],
      },
      "issues.update": {
        workspace: false,
        applicationIds: ["app-a"],
      },
      "procedures.read": {
        workspace: true,
        applicationIds: [],
      },
    },
  );
});
