import assert from "node:assert/strict";
import test from "node:test";
import { readResource } from "../../src/mcp/resources/resources.js";
import { blobContent } from "../helpers/types.js";
import { json, W, withApi } from "./resources.fixtures.js";
test("file contents use blobs and canonical metadata without leaking storage locators", async () => {
  await withApi(
    async (url) =>
      url.pathname.endsWith("/metadata")
        ? json({ context: { id: "issue-a" }, value: { id: "file-a" } })
        : new Response(new Uint8Array([0, 255, 1]), {
            headers: { "content-type": "application/octet-stream" },
          }),
    async () => {
      const result = await readResource({
        uri: W + "/issues/INC123/files/file-a/content",
      });
      assert.equal(blobContent(result.contents[0]), "AP8B");
      assert.equal(
        result.contents[0].uri,
        W + "/issues/issue-a/files/file-a/content",
      );
    },
  );
});
