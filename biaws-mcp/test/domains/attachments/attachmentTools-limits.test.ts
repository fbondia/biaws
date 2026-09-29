import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { errorInfo } from "../../helpers/types.js";
import { jsonResponse } from "./attachmentTools.fixtures.js";
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
        errorInfo(error).code === "ATTACHMENT_TOO_LARGE" &&
        errorInfo(error).statusCode === 413,
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
        errorInfo(error).code === "ATTACHMENT_TOO_LARGE" &&
        errorInfo(error).statusCode === 413,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLimit === undefined)
      delete process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES;
    else process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES = originalLimit;
  }
});
