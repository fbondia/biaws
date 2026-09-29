import assert from "node:assert/strict";
import test from "node:test";
import { currentRequestSignal } from "../../../src/runtime/requestContext.js";
import { connectTestServer } from "../../helpers/sdk.js";
import { required } from "../../helpers/types.js";
test("SDK cancellation reaches the request context while another call completes", async (t) => {
  let started: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let aborted: () => void = () => {};
  const cancelled = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  const session = await connectTestServer({
    dispatchTool: async (name) => {
      if (name === "fast") return { ok: true };
      return new Promise((resolve, reject) => {
        required(currentRequestSignal()).addEventListener(
          "abort",
          () => {
            aborted();
            reject(
              Object.assign(new Error("Cancelled"), {
                code: "REQUEST_CANCELLED",
                statusCode: 499,
              }),
            );
          },
          { once: true },
        );
        started();
      });
    },
  });
  t.after(() => session.close());
  const controller = new AbortController();
  const pending = session.client.callTool({ name: "slow" }, { signal: controller.signal });
  const rejected = assert.rejects(pending);
  await ready;
  assert.deepEqual((await session.client.callTool({ name: "fast" })).structuredContent, { ok: true });
  controller.abort();
  await rejected;
  await cancelled;
});

test("SDK cancellation aborts HTTP and connection close aborts pending requests", async (t) => {
  const originalFetch = globalThis.fetch;
  let started: () => void = () => {};
  let aborted: () => void = () => {};
  let ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let cancelled = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  globalThis.fetch = async (url, options) =>
    new Promise((resolve, reject) => {
      required(options?.signal).addEventListener(
        "abort",
        () => {
          aborted();
          reject(required(options?.signal).reason);
        },
        { once: true },
      );
      started();
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const session = await connectTestServer();
  t.after(() => session.close());
  const controller = new AbortController();
  const pending = session.client.callTool({ name: "issues_search" }, { signal: controller.signal });
  const rejection = assert.rejects(pending);
  await ready;
  assert.ok((await session.client.listTools()).tools.length > 0);
  controller.abort();
  await rejection;
  await cancelled;
  ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  cancelled = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  const closing = session.client.callTool({ name: "issues_search" });
  const closed = assert.rejects(closing);
  await ready;
  await session.close();
  await closed;
  await cancelled;
});
