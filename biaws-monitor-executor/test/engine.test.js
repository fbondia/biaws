import assert from "node:assert/strict";
import test from "node:test";

import { ExecutorEngine } from "../src/engine.js";
import { ProviderRegistry } from "../src/providers.js";
import { createTelemetry } from "../src/telemetry.js";

const logger = { info() {}, warn() {}, error() {} };

function testProvider(execute) {
  return {
    configurationSchema: { type: "object" },
    validateConfiguration: (configuration) => configuration,
    normalizeEvidence: (evidence) => evidence,
    execute,
  };
}

function config(overrides = {}) {
  return {
    enabled: true,
    executorId: "executor-test",
    concurrency: 2,
    leaseSeconds: 60,
    renewIntervalMs: 10_000,
    pollIntervalMs: 1_000,
    retryAttempts: 4,
    retryBaseMs: 10,
    retryMaxMs: 1_000,
    shutdownGraceMs: 100,
    readinessMaxAgeMs: 60_000,
    ...overrides,
  };
}

function monitor(overrides = {}) {
  return {
    id: "monitor-1",
    name: "Health endpoint",
    workspaceId: "workspace-1",
    applicationId: "application-1",
    deploymentId: "deployment-1",
    runtimeId: "runtime-1",
    executionId: "execution-1",
    leaseToken: "lease-1",
    provider: "rest",
    timeoutSeconds: 1,
    scheduledFor: "2026-08-13T12:00:00.000Z",
    configuration: {},
    ...overrides,
  };
}

test("execution logs carry monitor and catalog context", async () => {
  const entries = [];
  const contextualLogger = Object.fromEntries(
    ["info", "warn", "error"].map((level) => [
      level,
      (event, fields) => entries.push({ level, event, fields }),
    ]),
  );
  const engine = new ExecutorEngine({
    api: {
      async acquire() {
        return { items: [monitor()] };
      },
      async publish() {
        return { created: true };
      },
    },
    providers: new ProviderRegistry().register(
      "rest",
      testProvider(async () => ({ status: "healthy" })),
    ),
    config: config(),
    telemetry: createTelemetry(),
    logger: contextualLogger,
    now: () => new Date("2026-08-13T12:00:05.000Z"),
  });

  await engine.pollOnce();

  const started = entries.find(
    ({ event }) => event === "executor_execution_started",
  );
  const completed = entries.find(
    ({ event }) => event === "executor_execution_completed",
  );
  assert.deepEqual(started.fields, {
    workspaceId: "workspace-1",
    applicationId: "application-1",
    deploymentId: "deployment-1",
    runtimeId: "runtime-1",
    monitorId: "monitor-1",
    monitorName: "Health endpoint",
    executionId: "execution-1",
    provider: "rest",
    scheduledFor: "2026-08-13T12:00:00.000Z",
  });
  assert.equal(completed.fields.runtimeId, "runtime-1");
  assert.equal(completed.fields.status, "healthy");
  assert.equal(completed.fields.durationMs, 0);
});

test("two replicas sharing the API publish one acquired occurrence", async () => {
  const queue = [monitor()];
  const published = [];
  const sharedApi = {
    async acquire() {
      const item = queue.shift();
      return { items: item ? [item] : [] };
    },
    async renew() {
      throw new Error("renew should not be needed");
    },
    async publish(leaseToken, payload) {
      published.push({ leaseToken, payload });
      return { created: true };
    },
  };
  const providers = new ProviderRegistry().register(
    "rest",
    testProvider(async () => {
      return { status: "healthy", metadata: { duration_ms: 5 } };
    }),
  );
  const engines = ["replica-a", "replica-b"].map(
    (executorId) =>
      new ExecutorEngine({
        api: sharedApi,
        providers,
        config: config({ executorId }),
        telemetry: createTelemetry(),
        logger,
        now: () => new Date("2026-08-13T12:00:05.000Z"),
      }),
  );

  const acquired = await Promise.all(
    engines.map((engine) => engine.pollOnce()),
  );

  assert.equal(acquired.flat().length, 1);
  assert.equal(published.length, 1);
  assert.equal(published[0].payload.status, "healthy");
});

test("temporary API failures use bounded exponential backoff", async () => {
  let attempts = 0;
  const delays = [];
  const engine = new ExecutorEngine({
    api: {
      async acquire() {
        attempts += 1;
        if (attempts < 3)
          throw Object.assign(new Error("temporary"), { retryable: true });
        return { items: [] };
      },
    },
    providers: new ProviderRegistry(),
    config: config(),
    telemetry: createTelemetry(),
    logger,
    sleep: async (delay) => delays.push(delay),
  });

  await engine.pollOnce();

  assert.equal(attempts, 3);
  assert.equal(delays.length, 2);
  assert.ok(delays[0] <= 10);
  assert.ok(delays[1] <= 20);
});

test("continuous polling can acquire again while an earlier job is running", async () => {
  let releaseFirst;
  const firstPending = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const queue = [
    monitor({ configuration: { wait: true } }),
    monitor({
      id: "monitor-2",
      executionId: "execution-2",
      leaseToken: "lease-2",
      configuration: { wait: false },
    }),
  ];
  const published = [];
  const engine = new ExecutorEngine({
    api: {
      async acquire() {
        const item = queue.shift();
        return { items: item ? [item] : [] };
      },
      async publish(leaseToken) {
        published.push(leaseToken);
        return { created: true };
      },
    },
    providers: new ProviderRegistry().register(
      "rest",
      testProvider(async ({ configuration }) => {
        if (configuration.wait) await firstPending;
        return { status: "healthy" };
      }),
    ),
    config: config(),
    telemetry: createTelemetry(),
    logger,
  });

  await engine.pollOnce({ waitForJobs: false });
  await engine.pollOnce({ waitForJobs: false });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(published, ["lease-2"]);

  releaseFirst();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(published.sort(), ["lease-1", "lease-2"]);
});

test("long executions renew the lease before publishing", async () => {
  let releaseProvider;
  const providerPending = new Promise((resolve) => {
    releaseProvider = resolve;
  });
  const sleepers = [];
  let renewals = 0;
  let publications = 0;
  const engine = new ExecutorEngine({
    api: {
      async acquire() {
        return { items: [monitor()] };
      },
      async renew() {
        renewals += 1;
        return { monitor: monitor() };
      },
      async publish() {
        publications += 1;
        return { created: true };
      },
    },
    providers: new ProviderRegistry().register(
      "rest",
      testProvider(async () => {
        await providerPending;
        return { status: "healthy" };
      }),
    ),
    config: config({ renewIntervalMs: 500 }),
    telemetry: createTelemetry(),
    logger,
    sleep: (_delay, signal) =>
      new Promise((resolve, reject) => {
        sleepers.push(resolve);
        signal?.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  });

  const poll = engine.pollOnce();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sleepers.length, 1);
  sleepers.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renewals, 1);
  releaseProvider();
  await poll;
  assert.equal(publications, 1);
});

test("missing provider produces a sanitized unknown observation", async () => {
  let published;
  const engine = new ExecutorEngine({
    api: {
      async acquire() {
        return { items: [monitor({ provider: "shell" })] };
      },
      async publish(_leaseToken, payload) {
        published = payload;
        return { created: true };
      },
    },
    providers: new ProviderRegistry(),
    config: config(),
    telemetry: createTelemetry(),
    logger,
  });

  await engine.pollOnce();

  assert.equal(published.status, "unknown");
  assert.equal(published.metadata.failure_kind, "provider_unavailable");
  assert.doesNotMatch(JSON.stringify(published), /configuration/u);
});

test("provider timeout is published even when the provider ignores cancellation", async () => {
  let published;
  const engine = new ExecutorEngine({
    api: {
      async acquire() {
        return { items: [monitor({ timeoutSeconds: 0.001 })] };
      },
      async publish(_leaseToken, payload) {
        published = payload;
        return { created: true };
      },
    },
    providers: new ProviderRegistry().register(
      "rest",
      testProvider(async () => {
        return new Promise(() => {});
      }),
    ),
    config: config(),
    telemetry: createTelemetry(),
    logger,
  });

  await engine.pollOnce();

  assert.equal(published.status, "unknown");
  assert.equal(published.metadata.failure_kind, "timeout");
});

test("each acquisition executes the latest monitor configuration", async () => {
  const queue = [
    monitor({ executionId: "execution-1", configuration: { revision: 1 } }),
    monitor({
      executionId: "execution-2",
      leaseToken: "lease-2",
      configuration: { revision: 2 },
    }),
  ];
  const executedRevisions = [];
  const engine = new ExecutorEngine({
    api: {
      async acquire() {
        const item = queue.shift();
        return { items: item ? [item] : [] };
      },
      async publish() {
        return { created: true };
      },
    },
    providers: new ProviderRegistry().register(
      "rest",
      testProvider(async ({ configuration }) => {
        executedRevisions.push(configuration.revision);
        return { status: "healthy" };
      }),
    ),
    config: config(),
    telemetry: createTelemetry(),
    logger,
  });

  await engine.pollOnce();
  await engine.pollOnce();

  assert.deepEqual(executedRevisions, [1, 2]);
});
