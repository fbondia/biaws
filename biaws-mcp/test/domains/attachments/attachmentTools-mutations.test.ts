import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { jsonResponse } from "./attachmentTools.fixtures.js";
test("attachment tag updates and deletion use the domain routes", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; options: RequestInit }[] = [];
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
    assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
      tags: ["log"],
    });
    assert.equal(calls[1].options.method, "DELETE");
    assert.equal(
      new URL(calls[1].url).pathname,
      "/api/knowledge/documents/DOC-1/attachments/attachment-2",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
