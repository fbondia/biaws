import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
import { response } from "./issueCommentTools.fixtures.js";
test("issues_add_comment posts text and an optional date to the issue route", async () => {
  const originalFetch = globalThis.fetch;
  let call: { url: string; options: RequestInit } | undefined;
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
      new URL(required(call).url).pathname,
      "/api/issues/ISSUE%2F001/comments",
    );
    assert.equal(required(call).options.method, "POST");
    assert.deepEqual(JSON.parse(String(required(call).options.body)), {
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
  let call: { url: string; options: RequestInit } | undefined;
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
      new URL(required(call).url).pathname,
      "/api/issues/ISSUE-001/comments/comment%2F1",
    );
    assert.equal(required(call).options.method, "PUT");
    assert.deepEqual(JSON.parse(String(required(call).options.body)), {
      text: "Updated",
    });
    assert.equal(required(result.comments)[0].text, "Updated");
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
