import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { response } from "./knowledgeContextTools.fixtures.js";
test("EML import sends application context through multipart fields", async () => {
  const originalFetch = globalThis.fetch;
  let sentForm: BodyInit | null | undefined;
  globalThis.fetch = async (_url, options = {}) => {
    sentForm = options.body;
    return response({ mode: "dry-run" });
  };
  try {
    await dispatchTool("issues_import_eml", {
      filename: "issue.eml",
      contentBase64: Buffer.from("Subject: Example\n\nBody").toString("base64"),
      applicationId: "application-1",
      affectedComponentIds: ["component-1"],
    });
    assert.ok(sentForm instanceof FormData);
    assert.equal(sentForm.get("applicationId"), "application-1");
    assert.equal(sentForm.get("affectedComponentIds"), JSON.stringify(["component-1"]));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
