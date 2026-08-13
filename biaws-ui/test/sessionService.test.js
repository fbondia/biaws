import assert from "node:assert/strict";
import test from "node:test";

import {
  configureApiSession,
  executeApiRequest,
  readPayload,
  reportApiFailure,
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
  const events = [];
  const service = createSessionService({
    adapter: fake.adapter,
    clearSensitiveState: (reason) => cleared.push(reason),
    eventSink: (event) => events.push(event),
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
  assert.equal(events.at(-1).event, "session.expiration.detected");
});

test("failed reauthentication keeps the expired state until credentials are accepted", async () => {
  const actor = { id: "actor-reauth", workspaceId: "workspace-reauth" };
  const fake = createFakeSessionAdapter({
    actor,
    signInError: sessionError("Credenciais inválidas", {
      code: "INVALID_CREDENTIALS",
      statusCode: 401,
    }),
  });
  const service = createSessionService({ adapter: fake.adapter });

  await service.initialize();
  fake.expire("Sessão expirada");

  await assert.rejects(
    service.signIn({ email: "user@example.test", password: "invalid" }),
    /Credenciais inválidas/u,
  );
  assert.deepEqual(service.getState(), {
    reason: "Sessão expirada",
    status: SESSION_STATUS.EXPIRED,
  });
});

test("failed identity restoration after reauthentication preserves the expired state", async () => {
  const actor = { id: "actor-restore", workspaceId: "workspace-restore" };
  const fake = createFakeSessionAdapter({ actor });
  const service = createSessionService({ adapter: fake.adapter });

  await service.initialize();
  fake.expire("Sessão expirada");
  fake.setRestoreError(sessionError("Serviço de identidade indisponível"));

  await assert.rejects(
    service.signIn({ email: "user@example.test", password: "valid-password" }),
    /Serviço de identidade indisponível/u,
  );
  assert.deepEqual(service.getState(), {
    reason: "Sessão expirada",
    status: SESSION_STATUS.EXPIRED,
  });
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
  const events = [];
  const service = createSessionService({
    adapter: fake.adapter,
    clearSensitiveState: (reason) => cleared.push(reason),
    eventSink: (event) => events.push(event),
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
  assert.deepEqual(
    events
      .filter(({ event }) => event.includes("sign_"))
      .map(({ event, level }) => [event, level]),
    [
      ["session.sign_in.started", "info"],
      ["session.sign_in.completed", "info"],
      ["session.sign_out.started", "info"],
      ["session.sign_out.completed", "info"],
    ],
  );
});

test("workspace switch is deterministic and rolls selection back after a transient failure", async () => {
  const actor = { id: "actor-3", workspaceId: "workspace-1" };
  const fake = createFakeSessionAdapter({ actor, workspaceId: "workspace-1" });
  const events = [];
  const service = createSessionService({
    adapter: fake.adapter,
    eventSink: (event) => events.push(event),
  });
  await service.initialize();

  fake.setActor({ ...actor, workspaceId: "workspace-2" });
  await service.switchWorkspace("workspace-2");
  assert.equal(service.getState().actor.workspaceId, "workspace-2");

  fake.setRestoreError(sessionError("Temporary failure"));
  await service.switchWorkspace("workspace-3");
  assert.equal(service.getState().status, SESSION_STATUS.ERROR);
  assert.deepEqual(fake.calls.at(-1), ["setWorkspaceId", "workspace-2"]);
  assert.deepEqual(
    events
      .filter(({ event }) => event.includes("workspace_switch"))
      .map(({ event, level }) => [event, level]),
    [
      ["session.workspace_switch.started", "info"],
      ["session.workspace_switch.completed", "info"],
      ["session.workspace_switch.started", "info"],
      ["session.workspace_switch.failed", "error"],
    ],
  );
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
  const events = [];
  const service = createSessionService({
    adapter,
    eventSink: (event) => events.push(event),
  });
  await service.initialize();

  const firstSwitch = service.switchWorkspace("workspace-2");
  const secondSwitch = service.switchWorkspace("workspace-3");
  pendingRestores
    .find(({ workspaceId }) => workspaceId === "workspace-3")
    .reject(sessionError("Temporary failure"));
  await secondSwitch;
  assert.equal(selectedWorkspaceId, "workspace-1");
  assert.equal(service.getState().status, SESSION_STATUS.ERROR);
  assert.equal(events.at(-1).event, "session.workspace_switch.failed");

  pendingRestores
    .find(({ workspaceId }) => workspaceId === "workspace-2")
    .resolve({
      id: "actor-1",
      workspaceId: "workspace-2",
    });
  await firstSwitch;

  assert.equal(selectedWorkspaceId, "workspace-1");
  assert.equal(service.getState().status, SESSION_STATUS.ERROR);
  assert.equal(events.at(-1).event, "session.workspace_switch.discarded");
  assert.equal(events.at(-1).level, "warn");
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
  const events = [];
  const service = createSessionService({
    adapter: fake.adapter,
    eventSink: (event) => events.push(event),
  });

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
  assert.equal(
    events.find(({ event }) => event === "session.workspace_selection.rejected")
      ?.level,
    "warn",
  );
});

test("failed server sign out still removes the local actor and workspace", async () => {
  const fake = createFakeSessionAdapter({
    actor: { id: "actor-5", workspaceId: "workspace-5" },
    signOutError: sessionError("Server unavailable"),
    workspaceId: "workspace-5",
  });
  const events = [];
  const service = createSessionService({
    adapter: fake.adapter,
    eventSink: (event) => events.push(event),
  });
  await service.initialize();

  await assert.rejects(service.signOut(), /Server unavailable/);
  assert.deepEqual(service.getState(), {
    status: SESSION_STATUS.ANONYMOUS,
  });
  assert.deepEqual(fake.calls.at(-1), ["setWorkspaceId", ""]);
  assert.deepEqual(
    events.slice(-3).map(({ event, level }) => [event, level]),
    [
      ["session.sign_out.started", "info"],
      ["session.sign_out.remote_failed", "error"],
      ["session.sign_out.completed", "info"],
    ],
  );
});

test("API failure reporting selects only operationally relevant failures", () => {
  const records = [];
  const logger = {
    error: (event, details) => records.push({ details, event, level: "error" }),
    warn: (event, details) => records.push({ details, event, level: "warn" }),
  };
  const report = (statusCode, path = "/api/items?token=must-not-appear") =>
    reportApiFailure({
      durationMs: 250,
      error: Object.assign(new Error("synthetic"), { statusCode }),
      logger,
      method: "GET",
      path,
      requestId: "request-1",
    });

  report(404);
  report(503, "/api/auth/sign-out");
  report(403);
  report(429);
  report(503);
  report(undefined);

  assert.deepEqual(
    records.map(({ event, level }) => [event, level]),
    [
      ["api.request.denied", "warn"],
      ["api.request.rejected", "warn"],
      ["api.request.failed", "error"],
      ["api.request.failed", "error"],
    ],
  );
  assert.equal(records[0].details.context.path, "/api/items");
  assert.equal(records[0].details.context.durationMs, 250);
  assert.doesNotThrow(() =>
    reportApiFailure({
      durationMs: 1,
      error: new Error("network"),
      logger: {
        error: () => {
          throw new Error("logger failed");
        },
      },
      method: "POST",
      path: "/api/items",
      requestId: "request-2",
    }),
  );
});

test("API request logging excludes query and request body while preserving duration", async () => {
  const previousWindow = globalThis.window;
  const records = [];
  const times = [100, 145];
  globalThis.window = { location: { origin: "https://ui.example.test" } };

  try {
    await assert.rejects(
      executeApiRequest({
        body: { password: "must-not-appear" },
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: { message: "Unavailable" } }), {
            headers: { "Content-Type": "application/json" },
            status: 503,
          }),
        logger: {
          error: (event, details) => records.push({ details, event }),
          warn() {},
        },
        method: "POST",
        now: () => times.shift(),
        params: { token: "must-not-appear" },
        path: "/api/important-operation",
      }),
      (error) => error.statusCode === 503,
    );
  } finally {
    globalThis.window = previousWindow;
  }

  assert.equal(records[0].event, "api.request.failed");
  assert.deepEqual(
    {
      durationMs: records[0].details.context.durationMs,
      method: records[0].details.context.method,
      path: records[0].details.context.path,
      statusCode: records[0].details.context.statusCode,
    },
    {
      durationMs: 45,
      method: "POST",
      path: "/api/important-operation",
      statusCode: 503,
    },
  );
  assert.doesNotMatch(JSON.stringify(records), /must-not-appear/);
});
