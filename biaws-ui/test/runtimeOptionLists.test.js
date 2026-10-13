import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { ALL_STATUS_OPTIONS, ALL_TYPE_OPTIONS, configureIssueConstants } from "../src/constants/issues.js";
import { configureRequestConstants, REQUEST_STATUS_OPTIONS } from "../src/data/requestConstants.js";
import { clearSessionScopedState } from "../src/infrastructure/session/scopedState.js";
import { createRuntimeOptionListsLoader } from "../src/App/runtimeOptionLists.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(clearSessionScopedState);

function scheduler() {
  let sequence = 0;
  const timers = new Map();
  return {
    timers,
    cancel: (id) => timers.delete(id),
    schedule(callback, delay) {
      const id = ++sequence;
      timers.set(id, { callback, delay });
      return id;
    },
    async run() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

test("session cleanup resets workspace-scoped option catalogs to build defaults", () => {
  configureRequestConstants([
    {
      defaultValue: "workspace-only",
      items: [{ active: true, value: "workspace-only" }],
      key: "demand.status",
    },
  ]);
  configureIssueConstants([
    {
      items: [{ active: true, label: "Workspace only", value: "workspace-only" }],
      key: "issue.type",
    },
  ]);

  clearSessionScopedState();

  assert.equal(REQUEST_STATUS_OPTIONS.includes("workspace-only"), false);
  assert.equal(
    ALL_TYPE_OPTIONS.some(({ value }) => value === "workspace-only"),
    false,
  );
  assert.equal(
    ALL_STATUS_OPTIONS.some(({ value }) => value === "open"),
    true,
  );
});

test("runtime option loader ignores obsolete and disposed responses", async () => {
  const first = deferred();
  const second = deferred();
  const third = deferred();
  const responses = [first, second, third];
  const applied = [];
  const loader = createRuntimeOptionListsLoader({
    apply: (items) => applied.push(items),
    load: () => responses.shift().promise,
  });

  const firstLoad = loader.load();
  const secondLoad = loader.load();
  second.resolve({ items: ["workspace-2"] });
  assert.equal(await secondLoad, true);
  first.resolve({ items: ["workspace-1"] });
  assert.equal(await firstLoad, false);

  const disposedLoad = loader.load();
  loader.dispose();
  third.resolve({ items: ["workspace-3"] });
  assert.equal(await disposedLoad, false);
  assert.deepEqual(applied, [["workspace-2"]]);
});

test("a transient catalog failure recovers workspace-specific types automatically", async () => {
  const clock = scheduler();
  let calls = 0;
  const errors = [];
  const loader = createRuntimeOptionListsLoader({
    ...clock,
    apply: configureIssueConstants,
    load: async () => {
      if (++calls === 1) throw new Error("Synthetic network failure");
      return {
        items: [{ key: "issue.type", items: [{ value: "additional", label: "Additional" }] }],
      };
    },
    onError: (error) => errors.push(error),
  });
  await assert.rejects(loader.load(), /Synthetic network failure/u);
  assert.equal(
    ALL_TYPE_OPTIONS.some(({ value }) => value === "additional"),
    false,
  );
  assert.equal(clock.timers.size, 1);
  await clock.run();
  assert.equal(
    ALL_TYPE_OPTIONS.some(({ value }) => value === "additional"),
    true,
  );
  assert.equal(clock.timers.size, 0);
  assert.equal(errors.length, 1);
  assert.equal(await loader.retry(), false);
  assert.equal(calls, 2);
  loader.dispose();
});

test("automatic retries are bounded and a later recovery event can try again", async () => {
  const clock = scheduler();
  let calls = 0;
  let failing = true;
  const applied = [];
  const loader = createRuntimeOptionListsLoader({
    ...clock,
    apply: (items) => applied.push(items),
    load: async () => {
      calls += 1;
      if (failing) throw Object.assign(new Error("Synthetic service outage"), { statusCode: 503 });
      return { items: ["recovered"] };
    },
  });
  await assert.rejects(loader.load());
  for (const delay of [1000, 2000, 4000]) {
    assert.equal([...clock.timers.values()][0].delay, delay);
    await clock.run();
  }
  assert.equal(clock.timers.size, 0);
  assert.equal(calls, 4);
  failing = false;
  assert.equal(await loader.retry(), true);
  assert.deepEqual(applied, [["recovered"]]);
  loader.dispose();
});

test("disposal cancels retries and ignores late failures without scheduling requests", async () => {
  const clock = scheduler();
  const late = deferred();
  const errors = [];
  let calls = 0;
  const loader = createRuntimeOptionListsLoader({
    ...clock,
    apply: () => assert.fail("Disposed response must not be applied"),
    load: () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("Synthetic outage")) : late.promise;
    },
    onError: (error) => errors.push(error),
  });
  await assert.rejects(loader.load());
  const pending = loader.load();
  assert.equal(clock.timers.size, 0);
  loader.dispose();
  late.reject(new Error("Late failure"));
  assert.equal(await pending, false);
  assert.equal(clock.timers.size, 0);
  assert.equal(errors.length, 1);
  assert.equal(await loader.load(), false);
  assert.equal(calls, 2);

  const scheduled = createRuntimeOptionListsLoader({
    ...clock,
    apply: () => {},
    load: async () => {
      throw new Error("Synthetic outage");
    },
  });
  await assert.rejects(scheduled.load());
  scheduled.dispose();
  assert.equal(clock.timers.size, 0);
});

test("authentication and permission errors do not trigger automatic retries", async () => {
  for (const statusCode of [401, 403]) {
    const clock = scheduler();
    const loader = createRuntimeOptionListsLoader({
      ...clock,
      apply: () => assert.fail("Failed catalog must not be applied"),
      load: async () => {
        throw Object.assign(new Error("Denied"), { statusCode });
      },
    });
    await assert.rejects(loader.load());
    assert.equal(clock.timers.size, 0);
    assert.equal(await loader.retry(), false);
    loader.dispose();
  }
});
