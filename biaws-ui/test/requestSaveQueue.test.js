import assert from "node:assert/strict";
import test from "node:test";

import { flushPendingRequestSaves } from "../src/components/requests/RequestsView/requestSaveQueue.js";

test("flushPendingRequestSaves cancela timers e persiste o último rascunho pendente", async () => {
  const timers = new Map([
    ["request-1", 101],
    ["request-2", 202],
  ]);
  const pendingRequests = new Map([
    ["request-1", { id: "request-1", title: "Última versão" }],
    ["request-2", { id: "request-2", title: "Outro rascunho" }],
  ]);
  const cancelled = [];
  const persisted = [];

  const results = await flushPendingRequestSaves({
    timers,
    pendingRequests,
    clearTimer: (timer) => cancelled.push(timer),
    persist: async (request) => persisted.push(request),
  });

  assert.deepEqual(cancelled, [101, 202]);
  assert.deepEqual(persisted, [
    { id: "request-1", title: "Última versão" },
    { id: "request-2", title: "Outro rascunho" },
  ]);
  assert.equal(
    results.every(({ status }) => status === "fulfilled"),
    true,
  );
  assert.equal(timers.size, 0);
  assert.equal(pendingRequests.size, 0);
});

test("flushPendingRequestSaves tenta todos os rascunhos mesmo quando uma gravação falha", async () => {
  const attempted = [];
  const results = await flushPendingRequestSaves({
    timers: new Map(),
    pendingRequests: new Map([
      ["request-1", { id: "request-1" }],
      ["request-2", { id: "request-2" }],
    ]),
    persist: async (request) => {
      attempted.push(request.id);
      if (request.id === "request-1") throw new Error("falha esperada");
    },
  });

  assert.deepEqual(attempted, ["request-1", "request-2"]);
  assert.deepEqual(
    results.map(({ status }) => status),
    ["rejected", "fulfilled"],
  );
});
