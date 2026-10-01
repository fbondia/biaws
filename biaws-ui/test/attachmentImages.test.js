import assert from "node:assert/strict";
import test from "node:test";

import {
  attachmentImageMarkdown,
  resolveAttachmentImage,
} from "../src/components/shared/MarkdownEditor/attachmentImages.js";
import { markdownToHtml, parseInlineMarkdown } from "../src/components/shared/MarkdownEditor/model.js";

const image = {
  id: "image-one",
  index: 0,
  filename: "Captura de tela.png",
  contentType: "image/png",
  cid: "<image-one@example.test>",
};
const pdf = { id: "document-one", index: 1, filename: "manual.pdf", contentType: "application/pdf" };

test("image references resolve by ID, imported index, filename and email CID", () => {
  const imported = { index: 7, filename: "foto.jpg", contentType: "image/jpeg" };
  const files = [image, imported, pdf];
  for (const reference of [
    "attachment:image-one",
    "anexo: Captura de tela.png",
    "Captura%20de%20tela.png",
    "cid:image-one@example.test",
    "cid:<image-one@example.test>",
  ]) {
    assert.equal(resolveAttachmentImage(reference, files), image);
  }
  assert.equal(resolveAttachmentImage("attachment:7", files), imported);
  assert.equal(resolveAttachmentImage("attachment:0", files), null, "ID is preferred when present");
});

test("unavailable, ambiguous, non-image and remote references never resolve", () => {
  const duplicate = { ...image, id: "image-two", index: 2 };
  const files = [image, duplicate, pdf, { id: "vector", filename: "logo.svg", contentType: "image/svg+xml" }];
  for (const reference of [
    "anexo: Captura de tela.png",
    "cid:image-one@example.test",
    "attachment:missing",
    "anexo: manual.pdf",
    "attachment:document-one",
    "attachment:vector",
    "https://example.test/image.png",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
  ]) {
    assert.equal(resolveAttachmentImage(reference, files), null, reference);
  }
  assert.equal(resolveAttachmentImage("attachment:image-one", files), image);
  assert.equal(resolveAttachmentImage("attachment:image-one"), null);
});

test("filenames preserve literal percent sequences and normalize Unicode", () => {
  const file = { ...image, filename: "captura%20.png" };
  assert.equal(resolveAttachmentImage("anexo: captura%20.png", [file]), file);
  assert.equal(
    resolveAttachmentImage("anexo: capturá.png", [{ ...image, filename: "capturá.png".normalize("NFD") }])?.id,
    image.id,
  );
});

test("editor creates stable references even for filenames containing brackets", () => {
  assert.equal(
    attachmentImageMarkdown({ ...image, filename: "captura [1].png" }),
    "![captura  1 .png](attachment:image-one)",
  );
  assert.equal(attachmentImageMarkdown({ index: 7, filename: "foto.jpg" }), "![foto.jpg](attachment:7)");
});

test("Markdown image tokens coexist with links and remain literal inside code", () => {
  const tokens = parseInlineMarkdown(
    "[anexo: Captura de tela.png] [cid:image-one@example.test] ![Tela](attachment:image-one) [Ajuda](https://example.test) `[anexo: Captura de tela.png]`",
  );
  assert.deepEqual(
    tokens.filter((token) => token.type === "image").map((token) => token.reference),
    ["anexo: Captura de tela.png", "cid:image-one@example.test", "attachment:image-one"],
  );
  assert.equal(tokens.find((token) => token.type === "link").href, "https://example.test");
  assert.equal(tokens.at(-1).type, "code");
  assert.equal(
    markdownToHtml("![Tela](https://example.test/tracker.png)"),
    "<p>![Tela](https://example.test/tracker.png)</p>",
  );
});
