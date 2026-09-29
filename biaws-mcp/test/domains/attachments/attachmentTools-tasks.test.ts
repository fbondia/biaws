import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { errorInfo, required } from "../../helpers/types.js";
import { jsonResponse } from "./attachmentTools.fixtures.js";
test("task uploads delegate parent resolution and file association to the API", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method) {
      return jsonResponse({
        request: {
          id: "507f1f77bcf86cd799439011",
          tasks: [{ id: "task-1", code: "DEV-7" }],
          attachments: [],
        },
      });
    }
    return jsonResponse(
      { request: {}, uploaded: [{ id: "attachment-1" }] },
      201,
    );
  };

  try {
    await dispatchTool("attachments_upload", {
      entityType: "task",
      entityId: "507f1f77bcf86cd799439011",
      taskId: "task-1",
      tags: ["evidência"],
      files: [
        {
          filename: "resultado.txt",
          contentBase64: Buffer.from("ok").toString("base64"),
        },
      ],
    });

    assert.equal(calls.length, 1);
    assert.equal(
      new URL(calls[0].url).pathname,
      "/api/requests/507f1f77bcf86cd799439011/tasks/task-1/attachments",
    );
    assert.ok(calls[0].options.body instanceof FormData);
    assert.equal(required(calls[0].options.body).get("tags"), '["evidência"]');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("task operations reject files that are not associated with that task", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse(
      {
        error: {
          code: "NOT_FOUND",
          message: "File does not belong to this task",
        },
      },
      404,
    );
  };

  try {
    await assert.rejects(
      () =>
        dispatchTool("attachments_delete", {
          entityType: "task",
          entityId: "507f1f77bcf86cd799439011",
          taskId: "task-1",
          attachmentId: "attachment-1",
        }),
      (error) =>
        errorInfo(error).code === "NOT_FOUND" &&
        errorInfo(error).statusCode === 404,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("task tag updates use the task endpoint so the API preserves the association", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method) {
      return jsonResponse({
        request: {
          id: "507f1f77bcf86cd799439011",
          tasks: [{ id: "task-1", code: "DEV-7" }],
          attachments: [{ id: "attachment-1", tags: ["dev-7"] }],
        },
      });
    }
    return jsonResponse({ attachment: { id: "attachment-1" } });
  };

  try {
    await dispatchTool("attachments_update_tags", {
      entityType: "task",
      entityId: "507f1f77bcf86cd799439011",
      taskId: "dev-7",
      attachmentId: "attachment-1",
      tags: ["resultado"],
    });
    assert.equal(calls.length, 1);
    assert.equal(
      new URL(calls[0].url).pathname,
      "/api/requests/507f1f77bcf86cd799439011/tasks/dev-7/attachments/attachment-1/tags",
    );
    assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
      tags: ["resultado"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
