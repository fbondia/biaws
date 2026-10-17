import assert from "node:assert/strict";
import test from "node:test";
import {
  documentLinkMarkdown,
  insertMarkdownReference,
} from "../src/components/shared/MarkdownEditor/documentLinks.js";
import { markdownToHtml, parseInlineMarkdown } from "../src/components/shared/MarkdownEditor/model.js";

test("document links use a stable ID, carry workspace and escape document titles", () => {
  const document = {
    id: "id(a)",
    identifier: "mutable-alias",
    title: "Guia [API] \\ versão\n1",
    workspaceId: "workspace-a",
  };
  const markdown = documentLinkMarkdown(document, "workspace-a");
  assert.deepEqual(parseInlineMarkdown(markdown), [
    { type: "link", text: "Guia [API] \\ versão 1", href: "/documents/id%28a%29?workspaceId=workspace-a" },
  ]);
  assert.equal(
    markdownToHtml(markdown),
    '<p><a href="/documents/id%28a%29?workspaceId=workspace-a">Guia [API] \\ versão 1</a></p>',
  );
});

test("document link insertion rejects missing and foreign workspace context", () => {
  assert.throws(() => documentLinkMarkdown({ id: "one", workspaceId: "workspace-b" }, "workspace-a"), /workspace/);
  assert.throws(() => documentLinkMarkdown({ id: "one" }, ""), /workspace/);
  assert.throws(() => documentLinkMarkdown({}, "workspace-a"), /workspace/);
});

test("reference insertion replaces the selected range and returns the new caret position", () => {
  assert.deepEqual(
    insertMarkdownReference("Antes substituir depois", "[Guia](/documents/id?workspaceId=w)", { start: 6, end: 16 }),
    { value: "Antes [Guia](/documents/id?workspaceId=w) depois", cursor: 41 },
  );
  assert.deepEqual(insertMarkdownReference("texto", "link"), { value: "textolink", cursor: 9 });
});
