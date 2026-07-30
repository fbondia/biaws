import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildAttachmentStorageKey,
  writeIssueMirror,
} from "../src/helpers/issueStorage.js";
import { createAttachmentStorage } from "../src/storage/attachmentStorage.js";

test("local provider stores and reads an attachment through a provider-neutral key", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "issue-attachment-storage-"),
  );
  const storage = createAttachmentStorage({
    attachmentStorageLocalDir: rootDir,
  });
  const key = buildAttachmentStorageKey(
    "INC/123",
    {
      index: 0,
      filename: "evidência final.pdf",
      checksum: "abcdef1234567890",
    },
    { dates: { receivedEmailAt: "2026-05-18T12:00:00.000Z" } },
  );

  await storage.initialize();
  const metadata = await storage.save({
    key,
    content: Buffer.from("conteudo"),
  });

  assert.deepEqual(metadata, {
    provider: "local",
    key: "2026-05/INC_123/attachments/001-abcdef123456-evidencia_final.pdf",
    saved: true,
  });
  assert.equal(await storage.exists({ key }), true);
  assert.equal((await storage.read({ key })).toString(), "conteudo");
  assert.equal(
    (await readFile(path.join(rootDir, key))).toString(),
    "conteudo",
  );
  assert.equal(await storage.delete({ key }), true);
  assert.equal(await storage.exists({ key }), false);
});

test("local provider rejects keys outside its configured root", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "issue-attachment-storage-"),
  );
  const storage = createAttachmentStorage({
    attachmentStorageLocalDir: rootDir,
  });

  await assert.rejects(
    storage.save({ key: "../escape.txt", content: Buffer.from("x") }),
    /Invalid attachment storage key/u,
  );
});

test("factory rejects providers that are not installed", () => {
  assert.throws(
    () => createAttachmentStorage({ attachmentStorageProvider: "s3" }),
    /Unsupported attachment storage provider: s3/u,
  );
});

test("issue mirror is created below its reference month", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "issue-mirror-"));
  const issue = {
    id: "REQ123",
    dates: { receivedEmailAt: "2025-11-03T09:00:00.000Z" },
  };

  const mirror = writeIssueMirror({ issueDir: rootDir }, issue.id, issue, [
    { index: 0, hash: "abc", text: "comentário" },
  ]);

  assert.equal(mirror.issueDir, path.join(rootDir, "2025-11", "REQ123"));
  assert.equal(
    JSON.parse(await readFile(mirror.issueJson, "utf8")).id,
    "REQ123",
  );
});
