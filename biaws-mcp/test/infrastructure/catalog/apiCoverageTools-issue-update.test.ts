import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
import { withApi } from "./apiCoverageTools.fixtures.js";
test("issues_update writes only supplied mutable fields", async () => {
  await withApi(null, async (calls) => {
    await dispatchTool("issues_update", {
      issueId: " issue/1 ",
      title: " Revised ",
      text: " **Details** ",
      applicationId: " app-2 ",
      affectedComponentIds: [],
      type: "request",
      status: "closed",
    });
    assert.equal(calls[0].method, "PATCH");
    assert.equal(required(calls[0].url).pathname, "/api/issues/issue%2F1");
    assert.deepEqual(calls[0].body, {
      title: "Revised",
      text: "**Details**",
      applicationId: "app-2",
      affectedComponentIds: [],
      type: "request",
      status: "closed",
    });
    await dispatchTool("issues_update", {
      issueId: "issue-1",
      title: "Only title",
    });
    assert.deepEqual(required(calls.at(-1)).body, { title: "Only title" });
  });
});
