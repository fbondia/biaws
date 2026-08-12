import assert from "node:assert/strict";
import test from "node:test";

import {
  configureApiSession,
  readPayload,
  workspaceHeaders,
} from "../src/api/client.js";
import {
  createSessionService,
  SESSION_STATUS,
} from "../src/infrastructure/session/service.js";
import { createFakeSessionAdapter } from "../src/infrastructure/session/testing.js";

function sessionError(message, { code, statusCode } = {}) {
  return Object.assign(new Error(message), { code, statusCode });
}

test("API client obtains workspace and expiration through the narrow session integration", async () => {
  const authenticationFailures = [];
  const disconnect = configureApiSession({
    getWorkspaceId: () => "workspace-explicit",
    onUnauthorized: (failure) => authenticationFailures.push(failure),
  });

  try {
    assert.deepEqual(workspaceHeaders({ Accept: "application/json" }), {
      Accept: "application/json",
      "X-Biaws-Workspace-Id": "workspace-explicit",
    });
    assert.deepEqual(
      workspaceHeaders({ Accept: "application/json" }, "workspace-captured"),
      {
        Accept: "application/json",
        "X-Biaws-Workspace-Id": "workspace-captured",
      },
    );

    await assert.rejects(
      readPayload(
        new Response(
          JSON.stringify({
            error: { code: "SESSION_REVOKED", message: "Session revoked" },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 401,
          },
        ),
      ),
      (error) => error.statusCode === 401 && error.code === "SESSION_REVOKED",
    );
    assert.deepEqual(authenticationFailures, [
      {
        code: "SESSION_REVOKED",
        reason: "Session revoked",
        statusCode: 401,
      },
    ]);
  } finally {
    disconnect();
  }

  assert.deepEqual(workspaceHeaders(), {});
});

test("session restores an actor and transitions an authenticated request to expired on 401", async () => {
  const actor = { id: "actor-1", workspaceId: "workspace-1" };
  const fake = createFakeSessionAdapter({ actor, workspaceId: "workspace-1" });
  const cleared = [];
  const service = createSessionService({
    adapter: fake.adapter,
    clearSensitiveState: (reason) => cleared.push(reason),
  });

  await service.initialize();
  assert.deepEqual(service.getState(), {
    actor,
    status: SESSION_STATUS.AUTHENTICATED,
  });

  fake.expire("Credencial revogada");
  assert.deepEqual(service.getState(), {
    reason: "Credencial revogada",
    status: SESSION_STATUS.EXPIRED,
  });
  assert.deepEqual(cleared, ["expired"]);
});

test("initial 401 is anonymous while a transient restore failure remains an error", async () => {
  const unauthenticated = createFakeSessionAdapter({
    restoreError: sessionError("Authentication required", { statusCode: 401 }),
  });
  const anonymousService = createSessionService({
    adapter: unauthenticated.adapter,
  });

  await anonymousService.initialize();
  assert.deepEqual(anonymousService.getState(), {
    status: SESSION_STATUS.ANONYMOUS,
  });

  const unavailable = createFakeSessionAdapter({
    restoreError: sessionError("Network unavailable"),
  });
  const errorService = createSessionService({ adapter: unavailable.adapter });

  await errorService.initialize();
  assert.deepEqual(errorService.getState(), {
    error: {
      code: "SESSION_ERROR",
      message: "Network unavailable",
      retryable: true,
    },
    status: SESSION_STATUS.ERROR,
  });
});

test("sign in restores the compatibility actor and sign out clears local session state", async () => {
  const actor = { id: "actor-2", workspaceId: "workspace-2" };
  const fake = createFakeSessionAdapter();
  const cleared = [];
  const service = createSessionService({
    adapter: fake.adapter,
    clearSensitiveState: (reason) => cleared.push(reason),
  });

  await service.initialize();
  fake.setActor(actor);
  await service.signIn({ email: "user@example.test", password: "synthetic" });
  assert.deepEqual(service.getState(), {
    actor,
    status: SESSION_STATUS.AUTHENTICATED,
  });

  await service.signOut();
  assert.deepEqual(service.getState(), {
    status: SESSION_STATUS.ANONYMOUS,
  });
  assert.deepEqual(cleared, ["sign-in", "sign-out"]);
  assert.deepEqual(fake.calls.at(-1), ["setWorkspaceId", ""]);
});

test("workspace switch is deterministic and rolls selection back after a transient failure", async () => {
  const actor = { id: "actor-3", workspaceId: "workspace-1" };
  const fake = createFakeSessionAdapter({ actor, workspaceId: "workspace-1" });
  const service = createSessionService({ adapter: fake.adapter });
  await service.initialize();

  fake.setActor({ ...actor, workspaceId: "workspace-2" });
  await service.switchWorkspace("workspace-2");
  assert.equal(service.getState().actor.workspaceId, "workspace-2");

  fake.setRestoreError(sessionError("Temporary failure"));
  await service.switchWorkspace("workspace-3");
  assert.equal(service.getState().status, SESSION_STATUS.ERROR);
  assert.deepEqual(fake.calls.at(-1), ["setWorkspaceId", "workspace-2"]);
});

test("an obsolete workspace switch cannot roll back a newer failed switch", async () => {
  let selectedWorkspaceId = "workspace-1";
  const pendingRestores = [];
  const adapter = {
    dispose() {},
    getWorkspaceId: () => selectedWorkspaceId,
    initialize() {},
    restore() {
      if (selectedWorkspaceId === "workspace-1") {
        return Promise.resolve({ id: "actor-1", workspaceId: "workspace-1" });
      }
      return new Promise((resolve, reject) => {
        pendingRestores.push({
          reject,
          resolve,
          workspaceId: selectedWorkspaceId,
        });
      });
    },
    setWorkspaceId(workspaceId) {
      selectedWorkspaceId = workspaceId;
    },
    signIn() {},
    signOut() {},
  };
  const service = createSessionService({ adapter });
  await service.initialize();

  const firstSwitch = service.switchWorkspace("workspace-2");
  const secondSwitch = service.switchWorkspace("workspace-3");
  pendingRestores
    .find(({ workspaceId }) => workspaceId === "workspace-3")
    .reject(sessionError("Temporary failure"));
  await secondSwitch;
  assert.equal(selectedWorkspaceId, "workspace-1");
  assert.equal(service.getState().status, SESSION_STATUS.ERROR);

  pendingRestores
    .find(({ workspaceId }) => workspaceId === "workspace-2")
    .resolve({
      id: "actor-1",
      workspaceId: "workspace-2",
    });
  await firstSwitch;

  assert.equal(selectedWorkspaceId, "workspace-1");
  assert.equal(service.getState().status, SESSION_STATUS.ERROR);
});

test("forbidden persisted workspace is cleared before restoring the unscoped actor", async () => {
  const actor = { id: "actor-4", workspaceId: "" };
  const forbidden = sessionError("Workspace forbidden", {
    code: "WORKSPACE_FORBIDDEN",
    statusCode: 403,
  });
  const fake = createFakeSessionAdapter({
    actor,
    restoreError: (workspaceId) => (workspaceId ? forbidden : null),
    workspaceId: "forbidden-workspace",
  });
  const service = createSessionService({ adapter: fake.adapter });

  await service.initialize();
  assert.deepEqual(service.getState(), {
    actor,
    status: SESSION_STATUS.AUTHENTICATED,
  });
  assert.deepEqual(
    fake.calls.filter(([name]) => name === "restore"),
    [
      ["restore", "forbidden-workspace"],
      ["restore", ""],
    ],
  );
});

test("failed server sign out still removes the local actor and workspace", async () => {
  const fake = createFakeSessionAdapter({
    actor: { id: "actor-5", workspaceId: "workspace-5" },
    signOutError: sessionError("Server unavailable"),
    workspaceId: "workspace-5",
  });
  const service = createSessionService({ adapter: fake.adapter });
  await service.initialize();

  await assert.rejects(service.signOut(), /Server unavailable/);
  assert.deepEqual(service.getState(), {
    status: SESSION_STATUS.ANONYMOUS,
  });
  assert.deepEqual(fake.calls.at(-1), ["setWorkspaceId", ""]);
});
