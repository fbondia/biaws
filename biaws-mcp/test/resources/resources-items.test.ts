import assert from "node:assert/strict";
import test from "node:test";
import { readResource } from "../../src/resources.js";
import { textContent } from "../helpers/types.js";
import { json, W, withApi } from "./resources.fixtures.js";
test("item reads return canonical IDs and navigable children without embedding all comments or files", async () => {
  await withApi(
    async (url) => {
      assert.equal(url.pathname, "/api/issues/INC123");
      return json({
        issue: {
          id: "canonical-issue",
          workspaceId: "workspace-a",
          applicationId: "app-a",
          title: "Synthetic issue",
          attachments: [{ id: "file-a" }],
        },
        comments: [{ text: "Large child content" }],
      });
    },
    async () => {
      const result = await readResource({ uri: W + "/issues/INC123" });
      const payload = JSON.parse(textContent(result.contents[0]));
      assert.equal(result.contents[0].uri, W + "/issues/canonical-issue");
      assert.equal(payload.comments, undefined);
      assert.equal(payload.issue.attachments, undefined);
      assert.ok(
        payload.links.some(
          (link: { uri: string }) =>
            link.uri === W + "/issues/canonical-issue/comments",
        ),
      );
      assert.ok(
        payload.links.some(
          (link: { uri: string }) =>
            link.uri === W + "/issues/canonical-issue/files",
        ),
      );
    },
  );
});
