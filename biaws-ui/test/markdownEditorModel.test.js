import assert from "node:assert/strict";
import test from "node:test";

import { markdownToHtml, parseMarkdownBlocks } from "../src/components/shared/MarkdownEditor/model.js";

test("paragraph preserves simple line breaks and inline formatting", () => {
  const fields =
    "**Nome:** Ana\n**Idade nas anotações:** 32 anos\n**Estado narrativo:** morador/personagem de interesse, com disponibilidade a verificar";
  const markdown = `## Identificação e idade\n${fields}`;

  assert.deepEqual(parseMarkdownBlocks(markdown), [
    { type: "heading", level: 2, text: "Identificação e idade" },
    { type: "paragraph", text: fields },
  ]);
  assert.equal(
    markdownToHtml(markdown),
    "<h4>Identificação e idade</h4>\n<p><strong>Nome:</strong> Ana<br><strong>Idade nas anotações:</strong> 32 anos<br><strong>Estado narrativo:</strong> morador/personagem de interesse, com disponibilidade a verificar</p>",
  );
});

test("blank lines separate paragraphs while CRLF preserves simple line breaks", () => {
  assert.equal(markdownToHtml("primeira\r\nsegunda\r\n\r\nterceira"), "<p>primeira<br>segunda</p>\n<p>terceira</p>");
});

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
  assert.equal(markdownToHtml("> antes\n>\n> depois"), "<blockquote>antes<br><br>depois</blockquote>");
});

test("code block preserves its normalized language", () => {
  assert.deepEqual(parseMarkdownBlocks("```Mermaid\nflowchart LR\n  A --> B\n```"), [
    {
      type: "code",
      language: "mermaid",
      text: "flowchart LR\n  A --> B",
    },
  ]);
});

test("code block without a language remains ordinary code", () => {
  assert.deepEqual(parseMarkdownBlocks("```\nconst value = 1;\n```"), [
    { type: "code", language: "", text: "const value = 1;" },
  ]);
});
