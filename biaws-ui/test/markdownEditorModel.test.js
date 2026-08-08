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

test("code block preserves its normalized language", () => {
  assert.deepEqual(
    parseMarkdownBlocks("```Mermaid\nflowchart LR\n  A --> B\n```"),
    [
      {
        type: "code",
        language: "mermaid",
        text: "flowchart LR\n  A --> B",
      },
    ],
  );
});

test("code block without a language remains ordinary code", () => {
  assert.deepEqual(parseMarkdownBlocks("```\nconst value = 1;\n```"), [
    { type: "code", language: "", text: "const value = 1;" },
  ]);
});
