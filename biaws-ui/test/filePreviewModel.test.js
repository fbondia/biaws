import assert from "node:assert/strict";
import test from "node:test";

import {
  htmlPreviewDocument,
  previewKind,
} from "../src/components/shared/filePreviewModel.js";

test("HTML preview recognizes extensions and content types", () => {
  assert.equal(
    previewKind({
      filename: "example.htm",
      contentType: "application/octet-stream",
    }),
    "html",
  );
  assert.equal(
    previewKind({
      filename: "example.bin",
      contentType: "text/html; charset=utf-8",
    }),
    "html",
  );
  assert.equal(
    previewKind({
      filename: "example.xhtml",
      contentType: "application/xhtml+xml",
    }),
    "html",
  );
});

test("HTML preview document blocks active and remote content by default", () => {
  const source = "<h1>Preview seguro</h1>";
  const document = htmlPreviewDocument(source);

  assert.match(document, /Content-Security-Policy/u);
  assert.match(document, /default-src 'none'/u);
  assert.match(document, /form-action 'none'/u);
  assert.match(document, /<body><h1>Preview seguro<\/h1><\/body>/u);
});
