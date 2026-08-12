import assert from "node:assert/strict";
import test from "node:test";

import {
  createLogger,
  normalizeLogError,
  sanitizeLogValue,
} from "../src/infrastructure/logging/service.js";
import {
  connectSessionLoggingContext,
  loggingContextFromSessionState,
} from "../src/infrastructure/session/runtime.js";
import { connectGlobalErrorLogging } from "../src/infrastructure/logging/runtime.js";
import { createFakeLoggingTransport } from "../src/infrastructure/logging/testing.js";

test("logger emits structured records and enriches context after session starts", () => {
  const fake = createFakeLoggingTransport();
  const logger = createLogger({
    context: { version: "test" },
    now: () => new Date("2026-08-12T23:00:00.000Z"),
    transports: [fake.transport],
  });

  logger.setContext({ actorId: "actor-1", workspaceId: "workspace-1" });
  logger.error("catalog.option_lists.load_failed", {
    context: {
      clientSecret: "synthetic-client-secret",
      password: "synthetic-password",
      payload: { complete: true },
      requestId: "request-1",
      token: "synthetic-token",
    },
    error: Object.assign(
      new Error("request failed token=synthetic-token", {
        cause: new Error("Authorization: Bearer synthetic-bearer"),
      }),
      { code: "UPSTREAM_FAILED", statusCode: 503 },
    ),
    message: "Catalog failed password=synthetic-password",
  });

  assert.equal(fake.records.length, 1);
  assert.deepEqual(fake.records[0].context, {
    actorId: "actor-1",
    clientSecret: "[REDACTED]",
    password: "[REDACTED]",
    payload: "[OMITTED]",
    requestId: "request-1",
    token: "[REDACTED]",
    version: "test",
    workspaceId: "workspace-1",
  });
  assert.equal(fake.records[0].event, "catalog.option_lists.load_failed");
  assert.equal(fake.records[0].level, "error");
  assert.equal(fake.records[0].service, "biaws-ui");
  assert.equal(fake.records[0].timestamp, "2026-08-12T23:00:00.000Z");
  assert.doesNotMatch(
    JSON.stringify(fake.records[0]),
    /synthetic-(token|password|bearer)/,
  );
  assert.equal(fake.records[0].error.code, "UPSTREAM_FAILED");
  assert.equal(fake.records[0].error.statusCode, 503);
  assert.equal(fake.records[0].error.cause.name, "Error");

  logger.clearContext(["actorId", "workspaceId"]);
  logger.info("session.logout.completed", { message: "Session ended" });
  assert.deepEqual(fake.records[1].context, { version: "test" });
});

test("sanitization bounds depth, collection size, strings and circular values", () => {
  const circular = { value: "123456789" };
  circular.self = circular;

  assert.deepEqual(
    sanitizeLogValue(
      {
        array: [1, 2, 3],
        circular,
        nested: { child: { hidden: true } },
      },
      { maxArrayItems: 2, maxDepth: 2, maxStringLength: 4 },
    ),
    {
      array: [1, 2],
      circular: { self: "[CIRCULAR]", value: "1234…[truncated]" },
      nested: { child: "[MAX_DEPTH]" },
    },
  );
});

test("transport failures and volume limits never interrupt callers", async () => {
  const logger = createLogger({
    limits: { maxEntriesPerWindow: 1 },
    now: () => new Date("2026-08-12T23:00:00.000Z"),
    transports: [
      {
        write() {
          throw new Error("sync transport failure");
        },
      },
      {
        flush() {
          throw new Error("flush transport failure");
        },
        write() {
          return Promise.reject(new Error("async transport failure"));
        },
      },
    ],
  });

  assert.doesNotThrow(() =>
    logger.warn("logging.transport.write_failed", { message: "synthetic" }),
  );
  assert.equal(
    logger.info("logging.volume.entry_dropped", { message: "synthetic" }),
    null,
  );
  await logger.flush();
  assert.equal(logger.getDiagnostics().droppedEntries, 4);
});

test("error normalization accepts non-errors and event names are validated", () => {
  assert.deepEqual(
    normalizeLogError(
      "password=synthetic https://person:pass@example.test?token=synthetic eyJheader.payload.signature",
    ),
    {
      message:
        "password=[REDACTED] https://[REDACTED]@example.test?token=[REDACTED]",
      name: "Error",
    },
  );
  const logger = createLogger();
  assert.throws(
    () => logger.info("not-valid", { message: "invalid event" }),
    /dominio\.acao\.resultado/,
  );
  assert.deepEqual(
    normalizeLogError({ code: "SESSION_ERROR", message: "Unavailable" }),
    { code: "SESSION_ERROR", message: "Unavailable", name: "Error" },
  );
});

test("text redaction removes spaced, Basic Auth and stringified JSON credentials", () => {
  const secrets = [
    "correct horse battery staple",
    "dXNlcjpwYXNz",
    "synthetic-json-secret",
  ];
  const normalized = normalizeLogError(
    [
      `password=${secrets[0]}`,
      `Authorization: Basic ${secrets[1]}`,
      JSON.stringify({ password: secrets[2] }),
    ].join("\n"),
  );
  const serialized = JSON.stringify(normalized);

  for (const secret of secrets)
    assert.doesNotMatch(serialized, new RegExp(secret));
  assert.match(serialized, /password=\[REDACTED\]/);
  assert.match(serialized, /authorization=\[REDACTED\]/i);
});

test("session context exposes only stable actor and workspace identifiers", () => {
  assert.deepEqual(
    loggingContextFromSessionState({
      actor: {
        email: "person@example.test",
        sessionId: "session-secret",
        userId: "actor-1",
        workspaceId: "workspace-1",
      },
      status: "authenticated",
    }),
    { actorId: "actor-1", workspaceId: "workspace-1" },
  );
  assert.equal(loggingContextFromSessionState({ status: "expired" }), null);
});

test("session integration enriches future records and clears context on disconnect", () => {
  const fake = createFakeLoggingTransport();
  const logger = createLogger({ transports: [fake.transport] });
  let state = { status: "anonymous" };
  let listener;
  let eventSink;
  const disconnect = connectSessionLoggingContext({
    logger,
    sessionService: {
      getState: () => state,
      setEventSink(nextEventSink) {
        eventSink = nextEventSink;
      },
      subscribe(nextListener) {
        listener = nextListener;
        return () => {
          listener = undefined;
        };
      },
    },
  });

  state = {
    actor: { userId: "actor-2", workspaceId: "workspace-2" },
    status: "authenticated",
  };
  listener(state);
  logger.info("session.context.enriched", { message: "synthetic" });
  assert.deepEqual(fake.records[0].context, {
    actorId: "actor-2",
    workspaceId: "workspace-2",
  });

  eventSink({
    event: "session.sign_in.completed",
    level: "info",
    message: "synthetic",
  });
  assert.equal(fake.records[1].event, "session.sign_in.completed");

  disconnect();
  logger.info("session.context.cleared", { message: "synthetic" });
  assert.deepEqual(fake.records[2].context, {});
  assert.equal(listener, undefined);
  assert.equal(eventSink, undefined);
});

test("global error boundaries report escaped failures and remove their listeners", () => {
  const listeners = new Map();
  const records = [];
  const target = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const disconnect = connectGlobalErrorLogging({
    logger: {
      error: (event, details) => records.push({ details, event }),
    },
    target,
  });

  listeners.get("error")({
    colno: 12,
    error: new Error("unexpected browser failure"),
    lineno: 34,
  });
  listeners.get("unhandledrejection")({
    reason: new Error("unexpected rejection"),
  });

  assert.deepEqual(
    records.map(({ event }) => event),
    ["application.error.unhandled", "application.rejection.unhandled"],
  );
  assert.deepEqual(records[0].details.context, {
    columnNumber: 12,
    lineNumber: 34,
  });
  disconnect();
  assert.equal(listeners.size, 0);
});
