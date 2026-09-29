import assert from "node:assert/strict";
import test from "node:test";
import { readResource } from "../../src/resources.js";
import { textContent } from "../helpers/types.js";
import { json, W, withApi } from "./resources.fixtures.js";
test("collection reads preserve pagination and link to individual comments", async () => {
  await withApi(
    async (url) => {
      assert.equal(url.pathname, "/api/issues/INC123/comments");
      assert.equal(url.searchParams.get("page"), "2");
      return json({
        context: { id: "canonical-issue" },
        items: [{ _id: "comment-a", text: "Evidence" }],
        meta: { page: 2, limit: 1, total: 2 },
      });
    },
    async () => {
      const result = await readResource({
        uri: W + "/issues/INC123/comments?page=2&limit=1",
      });
      const payload = JSON.parse(textContent(result.contents[0]));
      assert.equal(payload.meta.page, 2);
      assert.equal(
        payload.links[0].uri,
        W + "/issues/canonical-issue/comments/comment-a",
      );
    },
  );
});
