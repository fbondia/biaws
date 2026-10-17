import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { useEntityState } from "../src/navigation/useEntityState.js";
import { navigate } from "../src/navigation/location.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("direct selections restore, navigate history, reject missing records and discard obsolete loads", async () => {
  const dom = new JSDOM("<div id=app></div>", {
    url: "https://biaws.example.test/documents/doc-alias?workspaceId=workspace-a",
  });
  const previous = Object.fromEntries(
    ["window", "document", "navigator"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const key of Object.keys(previous))
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const pending = deferred();
  let select, lastError;
  const loads = [];
  function Harness() {
    const [value, setValue] = useEntityState("document", null, {
      workspaceId: "workspace-a",
      load: async (reference) => {
        loads.push(reference);
        if (reference === "slow") return pending.promise;
        if (reference === "missing") return null;
        return { id: reference === "doc-alias" ? "mongo-id" : reference, identifier: reference };
      },
      onError: (error) => {
        lastError = error.message;
      },
    });
    select = setValue;
    return createElement("output", null, value?.id || "none");
  }
  const root = createRoot(document.getElementById("app"));
  const shown = () => document.querySelector("output").textContent;
  try {
    await act(async () => root.render(createElement(Harness)));
    assert.equal(shown(), "mongo-id");
    assert.match(window.location.pathname, /doc-alias$/);
    await act(async () => select({ id: "second" }));
    assert.equal(window.location.pathname, "/documents/second");
    assert.equal(loads.length, 1, "opening a loaded record does not fetch it again");
    await act(async () => select(null));
    assert.equal(window.location.pathname, "/documents");
    assert.equal(window.location.search, "?workspaceId=workspace-a");
    await act(async () => {
      window.history.replaceState(null, "", "/documents/doc-alias?workspaceId=workspace-a");
      window.dispatchEvent(new window.PopStateEvent("popstate"));
    });
    assert.equal(shown(), "mongo-id");
    await act(async () => navigate("/documents/slow?workspaceId=workspace-a"));
    await act(async () => navigate("/documents/newer?workspaceId=workspace-a"));
    assert.equal(shown(), "newer");
    await act(async () => pending.resolve({ id: "slow" }));
    assert.equal(shown(), "newer");
    await act(async () => navigate("/documents/missing?workspaceId=workspace-a"));
    assert.equal(shown(), "none");
    assert.match(lastError, /sem acesso/);
    await act(async () => root.unmount());
    const before = window.location.href;
    select({ id: "late" });
    assert.equal(window.location.href, before, "unmounted details cannot navigate another workspace");
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  }
});
