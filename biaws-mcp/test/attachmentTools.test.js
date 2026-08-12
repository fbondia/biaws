import assert from "node:assert/strict";
import test from "node:test";

import { dispatchTool, listTools } from "../src/tools.js";

function jsonResponse(payload = {}, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("attachment tools expose the four supported file operations", () => {
  const tools = listTools().filter(({ name }) =>
    name.startsWith("attachments_"),
  );
  assert.deepEqual(
    tools.map(({ name }) => name),
    [
      "attachments_upload",
      "attachments_download",
      "attachments_update_tags",
      "attachments_delete",
    ],
  );
  for (const tool of tools) {
    assert.deepEqual(tool.inputSchema.properties.entityType.enum, [
      "issue",
      "demand",
      "task",
      "document",
    ]);
  }
});

test("attachments_upload sends files and tags through the existing multipart API", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse(
      { issue: { id: "INC-1" }, uploaded: [{ id: "a-1" }] },
      201,
    );
  };

  try {
    const result = await dispatchTool("attachments_upload", {
      entityType: "issue",
      entityId: "INC-1",
      tags: ["Evidência", "produção"],
      files: [
        {
          filename: "evidência.txt",
          contentType: "text/plain",
          contentBase64: Buffer.from("conteúdo").toString("base64"),
        },
      ],
    });

    assert.equal(result.uploaded[0].id, "a-1");
    assert.equal(calls.length, 1);
    assert.equal(
      new URL(calls[0].url).pathname,
      "/api/issues/INC-1/attachments",
    );
    assert.equal(calls[0].options.method, "POST");
    assert.ok(calls[0].options.body instanceof FormData);
    assert.equal(calls[0].options.body.get("tags"), '["evidência","produção"]');
    const file = calls[0].options.body.get("files");
    assert.equal(file.name, "evidência.txt");
    assert.equal(file.type, "text/plain");
    assert.equal(Buffer.from(await file.arrayBuffer()).toString(), "conteúdo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("attachments_download returns binary content as Base64 with response metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(Buffer.from("arquivo"), {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition":
          "attachment; filename=\"arquivo.txt\"; filename*=UTF-8''evid%C3%AAncia.txt",
      },
    });

  try {
    const result = await dispatchTool("attachments_download", {
      entityType: "document",
      entityId: "DOC-1",
      attachmentId: 3,
    });
    assert.deepEqual(result, {
      entityType: "document",
      entityId: "DOC-1",
      attachmentId: 3,
      filename: "evidência.txt",
      contentType: "text/plain",
      size: 7,
      contentBase64: Buffer.from("arquivo").toString("base64"),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("attachment tag updates and deletion use the domain routes", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true });
  };

  try {
    await dispatchTool("attachments_update_tags", {
      entityType: "demand",
      entityId: "507f1f77bcf86cd799439011",
      attachmentId: "attachment-1",
      tags: ["Log"],
    });
    await dispatchTool("attachments_delete", {
      entityType: "document",
      entityId: "DOC-1",
      attachmentId: "attachment-2",
    });

    assert.equal(calls[0].options.method, "PATCH");
    assert.equal(
      new URL(calls[0].url).pathname,
      "/api/requests/507f1f77bcf86cd799439011/attachments/attachment-1/tags",
    );
    assert.deepEqual(JSON.parse(calls[0].options.body), { tags: ["log"] });
    assert.equal(calls[1].options.method, "DELETE");
    assert.equal(
      new URL(calls[1].url).pathname,
      "/api/knowledge/documents/DOC-1/attachments/attachment-2",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("task uploads resolve the parent demand and preserve the task-code tag", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
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

    assert.equal(calls.length, 2);
    assert.equal(
      new URL(calls[0].url).pathname,
      "/api/requests/507f1f77bcf86cd799439011",
    );
    assert.equal(calls[1].options.body.get("tags"), '["evidência","dev-7"]');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("task operations reject files that are not associated with that task", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({
      request: {
        id: "507f1f77bcf86cd799439011",
        tasks: [{ id: "task-1", code: "DEV-7" }],
        attachments: [{ id: "attachment-1", tags: ["DEV-8"] }],
      },
    });
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
        error.code === "ATTACHMENT_NOT_ASSOCIATED_WITH_TASK" &&
        error.statusCode === 404,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("task tag updates cannot remove the task association", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
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
    assert.equal(calls.length, 2);
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      tags: ["resultado", "dev-7"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("attachment downloads enforce the configured MCP byte limit", async () => {
  const originalFetch = globalThis.fetch;
  const originalLimit = process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES;
  process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES = "4";
  globalThis.fetch = async () =>
    new Response(Buffer.from("12345"), {
      headers: { "Content-Length": "5" },
    });

  try {
    await assert.rejects(
      () =>
        dispatchTool("attachments_download", {
          entityType: "issue",
          entityId: "INC-1",
          attachmentId: "attachment-1",
        }),
      (error) =>
        error.code === "ATTACHMENT_TOO_LARGE" && error.statusCode === 413,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLimit === undefined)
      delete process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES;
    else process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES = originalLimit;
  }
});

test("attachment uploads reject oversized Base64 before calling the API", async () => {
  const originalFetch = globalThis.fetch;
  const originalLimit = process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES;
  process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES = "4";
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return jsonResponse({});
  };

  try {
    await assert.rejects(
      () =>
        dispatchTool("attachments_upload", {
          entityType: "issue",
          entityId: "INC-1",
          files: [
            {
              filename: "large.bin",
              contentBase64: Buffer.from("12345").toString("base64"),
            },
          ],
        }),
      (error) =>
        error.code === "ATTACHMENT_TOO_LARGE" && error.statusCode === 413,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLimit === undefined)
      delete process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES;
    else process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES = originalLimit;
  }
});
