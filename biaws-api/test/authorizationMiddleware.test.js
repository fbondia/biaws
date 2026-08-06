import assert from "node:assert/strict";
import test from "node:test";

import {
  actorCanAccessApplication,
  actorHasPermission,
  authorizationQuery,
  platformPermissionsForTechnicalRole,
  rejectDatabaseOverride,
  requireAllPermissions,
  requirePlatformPermissions,
  requireBodyFieldPermissions,
} from "../src/auth/authorizationMiddleware.js";

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
    },
  };
}

test("authorization is based on permissions, not group names", () => {
  assert.equal(
    actorHasPermission(
      { groups: [{ id: "administration" }], permissions: [] },
      "issues.read",
    ),
    false,
  );
});

test("application authorization is permission-specific and server-owned", () => {
  const actor = {
    workspaceId: "workspace-a",
    permissions: ["issues.read", "issues.update"],
    permissionScopes: {
      "issues.read": { workspace: false, applicationIds: ["app-a", "app-b"] },
      "issues.update": { workspace: false, applicationIds: ["app-a"] },
    },
  };
  assert.equal(actorCanAccessApplication(actor, "issues.read", "app-b"), true);
  assert.equal(
    actorCanAccessApplication(actor, "issues.update", "app-b"),
    false,
  );
  assert.deepEqual(
    authorizationQuery(actor, "issues.update", {
      workspaceId: "forged",
      applicationId: "app-b",
    }).authorizationScope,
    {
      workspaceId: "workspace-a",
      workspace: false,
      applicationIds: ["app-a"],
    },
  );
});

test("required permission returns a structured 403", () => {
  const res = responseRecorder();
  requireAllPermissions("issues.read")(
    { actor: { permissions: [] } },
    res,
    () => {
      assert.fail("must not call next");
    },
  );
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error.code, "FORBIDDEN");
});

test("technical admin receives platform permissions without workspace permissions", () => {
  assert.deepEqual(platformPermissionsForTechnicalRole("admin"), [
    "platform.workspaces.manage",
    "platform.audit.read",
  ]);
  assert.deepEqual(platformPermissionsForTechnicalRole("user"), []);

  const res = responseRecorder();
  let allowed = false;
  requirePlatformPermissions("platform.workspaces.manage")(
    {
      actor: {
        permissions: [],
        platformPermissions: ["platform.workspaces.manage"],
      },
    },
    res,
    () => {
      allowed = true;
    },
  );
  assert.equal(allowed, true);
  assert.equal(res.statusCode, 200);
});

test("field authorization requires every permission represented in the patch", () => {
  const middleware = requireBodyFieldPermissions(
    { status: "issues.status.update", type: "issues.update" },
    "issues.update",
  );
  const res = responseRecorder();
  middleware(
    {
      actor: { permissions: ["issues.status.update"] },
      body: { status: "closed", type: "incident" },
    },
    res,
    () => assert.fail("mixed patch must be refused"),
  );
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload.error.requiredPermissions, [
    "issues.status.update",
    "issues.update",
  ]);
});

test("database override is rejected before repository access", () => {
  const res = responseRecorder();
  rejectDatabaseOverride({ query: { db: "other" }, body: {} }, res, () => {
    assert.fail("must not call next");
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error.code, "DATABASE_OVERRIDE_FORBIDDEN");
});
