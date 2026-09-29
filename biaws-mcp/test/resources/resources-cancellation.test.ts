import assert from "node:assert/strict";
import test from "node:test";
import { currentRequestSignal } from "../../src/runtime/requestContext.js";
import { connectTestServer } from "../helpers/sdk.js";
import { required } from "../helpers/types.js";
import { W } from "./resources.fixtures.js";
test("SDK cancels a resource read without blocking tools on the connection", async (t) => {
  let started: () => void = () => {};
  let aborted: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const cancelled = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  const session = await connectTestServer({
    dispatchTool: async () => ({ ok: true }),
    readResource: async () =>
      new Promise((resolve, reject) => {
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
      }),
  });
  t.after(() => session.close());
  const controller = new AbortController();
  const pending = session.client.readResource(
    { uri: W },
    { signal: controller.signal },
  );
  const rejection = assert.rejects(pending);
  await ready;
  assert.deepEqual(
    (await session.client.callTool({ name: "fast" })).structuredContent,
    { ok: true },
  );
  controller.abort();
  await rejection;
  await cancelled;
});
