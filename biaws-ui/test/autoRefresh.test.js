import assert from "node:assert/strict";
import test from "node:test";

import { JSDOM } from "jsdom";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import {
  monitoringRefreshIntervalMs,
  useAutoRefresh,
} from "../src/hooks/useAutoRefresh.js";

test("monitoring refresh interval has a safe default and lower bound", () => {
  assert.equal(monitoringRefreshIntervalMs({}), 30_000);
  assert.equal(
    monitoringRefreshIntervalMs({ VITE_MONITORING_REFRESH_SECONDS: "15" }),
    15_000,
  );
  assert.equal(
    monitoringRefreshIntervalMs({ VITE_MONITORING_REFRESH_SECONDS: "1" }),
    5_000,
  );
  assert.equal(
    monitoringRefreshIntervalMs({
      VITE_MONITORING_REFRESH_SECONDS: "invalid",
    }),
    30_000,
  );
});

function installDom() {
  const dom = new JSDOM("<!doctype html><div id=app></div>");
  const previous = Object.fromEntries(
    ["document", "window"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: dom.window.document },
    window: { configurable: true, value: dom.window },
  });
  return () => {
    for (const [name, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
  };
}

test("auto refresh does not overlap requests", async () => {
  const cleanupDom = installDom();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  let releaseFirst;
  let calls = 0;
  const first = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  function Harness() {
    useAutoRefresh(
      async () => {
        calls += 1;
        if (calls === 1) await first;
      },
      { intervalMs: 5 },
    );
    return null;
  }
  const root = createRoot(document.getElementById("app"));
  try {
    flushSync(() => root.render(createElement(Harness)));
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(calls, 1);
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.ok(calls >= 2);
  } finally {
    flushSync(() => root.unmount());
    await new Promise((resolve) => setTimeout(resolve, 0));
    cleanupDom();
  }
});

test("auto refresh pauses while hidden and refreshes when visible", async () => {
  const cleanupDom = installDom();
  let visibility = "hidden";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  let calls = 0;
  function Harness() {
    useAutoRefresh(
      async () => {
        calls += 1;
      },
      { intervalMs: 5 },
    );
    return null;
  }
  const root = createRoot(document.getElementById("app"));
  try {
    flushSync(() => root.render(createElement(Harness)));
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(calls, 0);
    visibility = "visible";
    document.dispatchEvent(new window.Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(calls, 1);
  } finally {
    flushSync(() => root.unmount());
    await new Promise((resolve) => setTimeout(resolve, 0));
    cleanupDom();
  }
});
