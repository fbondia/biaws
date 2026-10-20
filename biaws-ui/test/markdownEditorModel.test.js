import assert from "node:assert/strict";
import test from "node:test";

import {
  markdownToHtml,
  parseInlineMarkdown,
  parseMarkdownBlocks,
} from "../src/components/shared/MarkdownEditor/model.js";

test("HTTP, HTTPS and www URLs become links, including angle autolinks", () => {
  const source =
    "http://example.test https://example.test/path?q=1&lang=pt#part www.example.test <https://example.test/a>";
  const links = parseInlineMarkdown(source).filter(({ type }) => type === "link");
  assert.deepEqual(
    links.map(({ href }) => href),
    [
      "http://example.test",
      "https://example.test/path?q=1&lang=pt#part",
      "https://www.example.test",
      "https://example.test/a",
    ],
  );
  assert.equal(links[2].text, "www.example.test");
  assert.match(markdownToHtml(source), /href="https:\/\/example.test\/path\?q=1&amp;lang=pt#part"/u);
});

test("autolinks exclude surrounding punctuation but preserve balanced URL parentheses", () => {
  const source = "(https://example.test/a_(b)). [https://example.test/page], https://example.test/end!";
  assert.deepEqual(
    parseInlineMarkdown(source)
      .filter(({ type }) => type === "link")
      .map(({ href }) => href),
    ["https://example.test/a_(b)", "https://example.test/page", "https://example.test/end"],
  );
  assert.equal(
    parseInlineMarkdown(source)
      .map(({ text }) => text)
      .join(""),
    source,
  );
});

test("URLs are linked inside formatted text, headings, quotes, lists and tables", () => {
  const html = markdownToHtml(
    "## https://example.test\n\n> **https://example.test**\n\n- *www.example.test*\n\n| Site |\n| --- |\n| https://example.test |",
  );
  assert.equal((html.match(/<a /gu) || []).length, 4);
  assert.match(html, /<strong><a href="https:\/\/example.test"/u);
  assert.match(html, /<em><a href="https:\/\/www.example.test"/u);
});

test("autolinks preserve explicit links and images and never link code or unsafe schemes", () => {
  const tokens = parseInlineMarkdown(
    "[Site](https://example.test) ![Imagem](https://example.test/a.png) `https://example.test` javascript:alert(1) ftp://example.test person@www.example.test",
  );
  assert.equal(tokens.filter(({ type }) => type === "link").length, 1);
  assert.equal(tokens.filter(({ type }) => type === "image").length, 1);
  assert.equal(tokens.find(({ type }) => type === "code").text, "https://example.test");
  assert.doesNotMatch(markdownToHtml("```text\nhttps://example.test\n```"), /<a /u);
});

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
