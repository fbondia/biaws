import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
import { jsonResponse } from "./attachmentTools.fixtures.js";
test("attachments_upload sends files and tags through the existing multipart API", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; options: RequestInit }[] = [];
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

    assert.equal(required(result.uploaded)[0].id, "a-1");
    assert.equal(calls.length, 1);
    assert.equal(
      new URL(calls[0].url).pathname,
      "/api/issues/INC-1/attachments",
    );
    assert.equal(calls[0].options.method, "POST");
    assert.ok(calls[0].options.body instanceof FormData);
    assert.equal(
      required(calls[0].options.body).get("tags"),
      '["evidência","produção"]',
    );
    const file = required(calls[0].options.body).get("files");
    assert.ok(file instanceof File);
    assert.equal(file.name, "evidência.txt");
    assert.equal(file.type, "text/plain");
    assert.equal(Buffer.from(await file.arrayBuffer()).toString(), "conteúdo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
