import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "../../../src/httpClient.js";
import { errorInfo } from "../../helpers/types.js";
for (const payload of [
  { items: [{ id: 42 }] },
  { items: "invalid" },
  { meta: { total: "10" } },
]) {
  test(`malformed upstream data fails without retries: ${JSON.stringify(payload)}`, async (t) => {
    const previous = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json(payload);
    };
    t.after(() => {
      globalThis.fetch = previous;
    });
    await assert.rejects(
      fetchJson("/api/issues"),
      (error) =>
        errorInfo(error).code === "INVALID_UPSTREAM_PAYLOAD" &&
        errorInfo(error).statusCode === 502 &&
        errorInfo(error).retryable === false,
    );
    assert.equal(calls, 1);
  });
}
