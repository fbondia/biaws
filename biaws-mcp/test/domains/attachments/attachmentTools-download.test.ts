import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
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
