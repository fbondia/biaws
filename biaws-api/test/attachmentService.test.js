import assert from "node:assert/strict";
import test from "node:test";

import { normalizeUploadFilename } from "../src/services/attachmentService.js";

test("multipart filename mojibake is decoded from Latin-1 to UTF-8 and normalized", () => {
  assert.equal(
    normalizeUploadFilename("Endpoints API AutomacÌ§aÌo - v3.docx"),
    "Endpoints API Automação - v3.docx",
  );
});

test("already valid Unicode filenames are preserved and normalized to NFC", () => {
  assert.equal(normalizeUploadFilename("Automação.docx"), "Automação.docx");
  assert.equal(normalizeUploadFilename("relatório.pdf"), "relatório.pdf");
  assert.equal(normalizeUploadFilename("plain-file.txt"), "plain-file.txt");
});
