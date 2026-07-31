import assert from "node:assert/strict";
import test from "node:test";

import {
  markdownToHtml,
  parseMarkdownBlocks,
} from "../src/components/shared/MarkdownEditor/model.js";

test("blockquote preserves explicit line breaks", () => {
  const markdown = "> primeira linha\n> segunda linha\n> **terceira linha**";
  const [quote] = parseMarkdownBlocks(markdown);

  assert.deepEqual(quote, {
    type: "quote",
    text: "primeira linha\nsegunda linha\n**terceira linha**",
  });
  assert.equal(
    markdownToHtml(markdown),
    "<blockquote>primeira linha<br>segunda linha<br><strong>terceira linha</strong></blockquote>",
  );
});

test("blockquote preserves an empty quoted line", () => {
  assert.equal(
    markdownToHtml("> antes\n>\n> depois"),
    "<blockquote>antes<br><br>depois</blockquote>",
  );
});
