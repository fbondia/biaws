import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFileTagCounts,
  tagColor,
} from "../src/components/shared/FilesPanel/model.js";

test("file tags are normalized, counted and sorted", () => {
  assert.deepEqual(
    buildFileTagCounts([
      { tags: [" Backend ", "urgent"] },
      { tags: ["backend", ""] },
      {},
    ]),
    [
      { tag: "backend", count: 2 },
      { tag: "urgent", count: 1 },
    ],
  );
});

test("file tag colors are deterministic CSS custom properties", () => {
  assert.deepEqual(tagColor("backend"), tagColor("backend"));
  assert.deepEqual(Object.keys(tagColor("urgent")), [
    "--file-tag-background",
    "--file-tag-border",
    "--file-tag-color",
  ]);
});
