import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOTSTRAP_STATUS,
  CAPABILITY_STATUS,
  disposeInfrastructureSafely,
  initializeInfrastructure,
} from "../src/infrastructure/bootstrap/bootstrap.js";
import { createInfrastructureCapabilities } from "../src/infrastructure/bootstrap/capabilities.js";
import { defineLoggingAdapter } from "../src/infrastructure/logging/contract.js";
import { createLogger } from "../src/infrastructure/logging/service.js";
import { createFakeLoggingTransport } from "../src/infrastructure/logging/testing.js";
import { defineMessagesAdapter } from "../src/infrastructure/messages/contract.js";
import { defineSessionAdapter } from "../src/infrastructure/session/contract.js";

test("infrastructure adapters initialize in documented order and dispose in reverse", async () => {
  const events = [];
  const adapter = (id, define) =>
    define({
      dispose() {
        events.push(`dispose:${id}`);
      },
      initialize() {
        events.push(`initialize:${id}`);
        return id;
      },
    });
  const capabilities = createInfrastructureCapabilities({
    logging: adapter("logging", defineLoggingAdapter),
    messages: adapter("messages", defineMessagesAdapter),
    session: adapter("session", defineSessionAdapter),
  });
  const transitions = [];

  const bootstrap = await initializeInfrastructure({
    capabilities,
    onStateChange(state) {
      transitions.push(state.status);
    },
  });

  assert.equal(bootstrap.state.status, BOOTSTRAP_STATUS.READY);
  assert.equal(transitions[0], BOOTSTRAP_STATUS.INITIALIZING);
  assert.equal(transitions.at(-1), BOOTSTRAP_STATUS.READY);
  assert.deepEqual(events, [
    "initialize:logging",
    "initialize:session",
    "initialize:messages",
  ]);

  await bootstrap.dispose();
  assert.deepEqual(events.slice(3), [
    "dispose:messages",
    "dispose:session",
    "dispose:logging",
  ]);
});

test("a non-critical failure degrades bootstrap without stopping independent capabilities", async () => {
  const events = [];
  const bootstrap = await initializeInfrastructure({
    capabilities: [
      {
        id: "optional",
        initialize() {
          throw new Error("optional unavailable");
        },
      },
      {
        id: "independent",
        initialize() {
          events.push("independent");
        },
      },
    ],
  });

  assert.equal(bootstrap.state.status, BOOTSTRAP_STATUS.DEGRADED);
  assert.deepEqual(events, ["independent"]);
  assert.deepEqual(bootstrap.state.capabilities[0].error, {
    message: "optional unavailable",
    name: "Error",
  });
});

test("bootstrap reports capability failures through an initialized logger", async () => {
  const fake = createFakeLoggingTransport();
  const logger = createLogger({ transports: [fake.transport] });

  const bootstrap = await initializeInfrastructure({
    capabilities: [
      { id: "logging", initialize: () => logger },
      {
        critical: true,
        id: "session",
        initialize() {
          throw new Error("session unavailable");
        },
      },
    ],
  });

  assert.equal(bootstrap.state.status, BOOTSTRAP_STATUS.FAILED);
  assert.equal(fake.records.length, 1);
  assert.equal(
    fake.records[0].event,
    "infrastructure.bootstrap.capability_failed",
  );
  assert.deepEqual(fake.records[0].context, {
    capabilityId: "session",
    critical: true,
  });
});

test("a reporting failure does not replace the original bootstrap result", async () => {
  const bootstrap = await initializeInfrastructure({
    capabilities: [
      {
        id: "logging",
        initialize: () => ({
          error() {
            throw new Error("logger unavailable");
          },
        }),
      },
      {
        critical: true,
        id: "session",
        initialize() {
          throw new Error("original session failure");
        },
      },
    ],
  });

  assert.equal(bootstrap.state.status, BOOTSTRAP_STATUS.FAILED);
  assert.equal(
    bootstrap.state.capabilities[1].error.message,
    "original session failure",
  );
});

test("dispose attempts every capability and aggregates failures without changing order", async () => {
  const events = [];
  const bootstrap = await initializeInfrastructure({
    capabilities: [
      {
        dispose() {
          events.push("logging");
        },
        id: "logging",
        initialize() {},
      },
      {
        dispose() {
          events.push("session");
          throw new Error("session cleanup failed");
        },
        id: "session",
        initialize() {},
      },
      {
        dispose() {
          events.push("messages");
        },
        id: "messages",
        initialize() {},
      },
    ],
  });

  await assert.rejects(bootstrap.dispose(), (error) => {
    assert.equal(error instanceof AggregateError, true);
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /session/);
    assert.equal(error.errors[0].cause.message, "session cleanup failed");
    return true;
  });
  assert.deepEqual(events, ["messages", "session", "logging"]);

  await assert.rejects(bootstrap.dispose(), AggregateError);
  assert.deepEqual(events, ["messages", "session", "logging"]);
});

test("safe disposal reports aggregate failures without rejecting", async () => {
  const failure = new AggregateError([], "cleanup failed");
  const reported = [];

  await disposeInfrastructureSafely(
    {
      async dispose() {
        throw failure;
      },
    },
    (error) => reported.push(error),
  );

  assert.deepEqual(reported, [failure]);
});

test("critical and dependent failures produce failed and blocked states", async () => {
  const bootstrap = await initializeInfrastructure({
    capabilities: [
      {
        critical: true,
        id: "session",
        initialize() {
          throw new Error("session unavailable");
        },
      },
      {
        dependsOn: ["session"],
        id: "profile",
        initialize() {
          assert.fail("blocked capability must not initialize");
        },
      },
    ],
  });

  assert.equal(bootstrap.state.status, BOOTSTRAP_STATUS.FAILED);
  assert.deepEqual(
    bootstrap.state.capabilities.map(({ status }) => status),
    [CAPABILITY_STATUS.FAILED, CAPABILITY_STATUS.BLOCKED],
  );
});
