import assert from "node:assert/strict";
import test from "node:test";

import { dispatchTool, listTools } from "../src/tools.js";

function response(payload = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("issue comment tools expose bounded schemas", () => {
  const tools = new Map(listTools().map((tool) => [tool.name, tool]));
  const add = tools.get("issues_add_comment");
  const update = tools.get("issues_update_comment");

  assert.deepEqual(add.inputSchema.required, ["issueId", "text"]);
  assert.deepEqual(update.inputSchema.required, [
    "issueId",
    "commentId",
    "text",
  ]);
  assert.equal(add.inputSchema.additionalProperties, false);
  assert.equal(update.inputSchema.additionalProperties, false);
});

test("issues_add_comment posts text and an optional date to the issue route", async () => {
  const originalFetch = globalThis.fetch;
  let call;
  globalThis.fetch = async (url, options = {}) => {
    call = { url: String(url), options };
    return response({ createdCommentId: "comment-1" });
  };

  try {
    const result = await dispatchTool("issues_add_comment", {
      issueId: " ISSUE/001 ",
      text: " **Investigated** ",
      date: "2026-08-25T10:00:00-03:00",
    });

    assert.equal(
      new URL(call.url).pathname,
      "/api/issues/ISSUE%2F001/comments",
    );
    assert.equal(call.options.method, "POST");
    assert.deepEqual(JSON.parse(call.options.body), {
      text: "**Investigated**",
      date: "2026-08-25T10:00:00-03:00",
    });
    assert.equal(result.createdCommentId, "comment-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("issues_update_comment puts the replacement text on the comment route", async () => {
  const originalFetch = globalThis.fetch;
  let call;
  globalThis.fetch = async (url, options = {}) => {
    call = { url: String(url), options };
    return response({ comments: [{ _id: "comment/1", text: "Updated" }] });
  };

  try {
    const result = await dispatchTool("issues_update_comment", {
      issueId: "ISSUE-001",
      commentId: " comment/1 ",
      text: " Updated ",
    });

    assert.equal(
      new URL(call.url).pathname,
      "/api/issues/ISSUE-001/comments/comment%2F1",
    );
    assert.equal(call.options.method, "PUT");
    assert.deepEqual(JSON.parse(call.options.body), { text: "Updated" });
    assert.equal(result.comments[0].text, "Updated");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("issue comment tools reject blank values before making a request", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response();
  };

  try {
    await assert.rejects(
      dispatchTool("issues_add_comment", {
        issueId: "ISSUE-001",
        text: "   ",
      }),
      /text is required/u,
    );
    await assert.rejects(
      dispatchTool("issues_update_comment", {
        issueId: "ISSUE-001",
        commentId: "   ",
        text: "Updated",
      }),
      /commentId is required/u,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
