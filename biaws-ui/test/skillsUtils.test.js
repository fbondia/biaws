import assert from "node:assert/strict";
import test from "node:test";

import {
  filesFromDataTransfer,
  fileSourcePath,
  relativeFilePath,
} from "../src/components/skills/SkillsView/utils.js";

function fileEntry(name) {
  return {
    isDirectory: false,
    isFile: true,
    name,
    file(resolve) {
      resolve({ name });
    },
  };
}

function directoryEntry(name, children) {
  return {
    isDirectory: true,
    isFile: false,
    name,
    createReader() {
      let read = false;
      return {
        readEntries(resolve) {
          if (read) {
            resolve([]);
            return;
          }
          read = true;
          resolve(children);
        },
      };
    },
  };
}

test("dropped skill directories preserve nested relative paths", async () => {
  const root = directoryEntry("example-skill", [
    fileEntry("SKILL.md"),
    directoryEntry("references", [fileEntry("guide.md")]),
  ]);

  const files = await filesFromDataTransfer({
    items: [{ kind: "file", webkitGetAsEntry: () => root }],
  });

  assert.deepEqual(files.map(fileSourcePath), [
    "example-skill/SKILL.md",
    "example-skill/references/guide.md",
  ]);
  assert.deepEqual(files.map(relativeFilePath), [
    "SKILL.md",
    "references/guide.md",
  ]);
});

test("file drops fall back to the browser FileList", async () => {
  const file = { name: "document.json" };
  const files = await filesFromDataTransfer({ files: [file], items: [] });

  assert.deepEqual(files, [file]);
});
