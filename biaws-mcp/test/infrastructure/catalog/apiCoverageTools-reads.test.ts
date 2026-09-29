import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
import { readCases, withApi } from "./apiCoverageTools.fixtures.js";
for (const [name, args, path, params] of readCases) {
  test(`${name} uses the scoped read endpoint and preserves its response`, async () => {
    await withApi(null, async (calls) => {
      const result = await dispatchTool(name, args);
      assert.deepEqual(result, { items: [{ id: "result" }] });
      assert.equal(calls.length, 1);
      assert.equal(required(calls[0].url).pathname, path);
      assert.deepEqual(
        Object.fromEntries(required(calls[0].url).searchParams),
        params,
      );
      assert.equal(calls[0].method, "GET");
      assert.equal(
        required(calls[0].headers).get("x-biaws-workspace-id"),
        "workspace-test",
      );
    });
  });
}
