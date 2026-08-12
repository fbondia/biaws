import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_STATUS_OPTIONS,
  ALL_TYPE_OPTIONS,
  configureIssueConstants,
} from "../src/constants/issues.js";
import {
  configureRequestConstants,
  REQUEST_STATUS_OPTIONS,
} from "../src/data/requestConstants.js";
import { clearSessionScopedState } from "../src/infrastructure/session/scopedState.js";
import { createRuntimeOptionListsLoader } from "../src/App/runtimeOptionLists.js";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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
      items: [
        { active: true, label: "Workspace only", value: "workspace-only" },
      ],
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
