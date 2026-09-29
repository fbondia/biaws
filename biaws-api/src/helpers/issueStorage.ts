import { textValue } from "./text.js";
type StorageOptions = object;
interface StorageAttachment {
  filename: string;
  checksum?: string | null;
  index?: number;
}
interface StorageComment {
  _id?: unknown;
  index?: number;
  hash?: string;
  [field: string]: unknown;
}
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isRecord } from "./records.js";
import { WORKSPACE_ROOT } from "../helpers/runtimePaths.js";

const ISSUES_ROOT = WORKSPACE_ROOT;

function readOption(options: StorageOptions, key: string) {
  return (
    (options as Record<string, unknown>)?.[key] ??
    (options as Record<string, unknown>)?.[
      key.replaceAll(/-([a-z])/gu, (_: string, letter: string) => letter.toUpperCase())
    ]
  );
}

function readConfiguredIssueDir(options: StorageOptions) {
  const explicitDir = textValue(readOption(options, "issue-dir") || "").trim();
  if (explicitDir) return path.resolve(explicitDir);

  const envDir = String(process.env.BIAWS_ISSUE_DIR || "").trim();
  if (!envDir) return "";

  return path.isAbsolute(envDir) ? envDir : path.resolve(ISSUES_ROOT, envDir);
}

export function getIssueBaseDir(options: StorageOptions) {
  const baseDir = readConfiguredIssueDir(options);
  if (!baseDir) {
    throw new Error("Missing issue directory. Set BIAWS_ISSUE_DIR in biaws/.env or pass --issue-dir <path>.");
  }

  return baseDir;
}

function sanitizePathSegment(value: unknown, fallback: string) {
  const sanitized = textValue(value || "")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/gu, "")
    .replaceAll(/[^a-zA-Z0-9._-]+/gu, "_")
    .replaceAll(/^_+|_+$/gu, "")
    .slice(0, 160);

  return sanitized || fallback;
}

export function resolveIssueStorageMonth(issueOrDate: unknown) {
  const issue = isRecord(issueOrDate) ? issueOrDate : {};
  const dates = isRecord(issue.dates) ? issue.dates : {};
  const candidates = [
    issueOrDate instanceof Date || typeof issueOrDate === "string" ? issueOrDate : null,
    dates.receivedEmailAt,
    dates.jiraCreatedAt,
    dates.firstThreadEmailAt,
    dates.issueCreatedAt,
    issue.createdAt,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!(candidate instanceof Date) && typeof candidate !== "string" && typeof candidate !== "number") continue;
    const date = candidate instanceof Date ? candidate : new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 7);
  }

  return new Date().toISOString().slice(0, 7);
}

function resolveIssuePaths(options: StorageOptions, issueId: unknown, issueOrDate: unknown) {
  const baseDir = getIssueBaseDir(options);
  const month = resolveIssueStorageMonth(issueOrDate);
  const issueDir = path.join(baseDir, month, sanitizePathSegment(issueId, "issue"));

  return {
    baseDir,
    issueDir,
    issueJson: path.join(issueDir, "issue.json"),
    commentsDir: path.join(issueDir, "comments"),
    attachmentsDir: path.join(issueDir, "attachments"),
  };
}

export function buildAttachmentStorageKey(issueId: unknown, attachment: StorageAttachment, issueOrDate: unknown) {
  const safeName = sanitizePathSegment(attachment.filename, "anexo");
  const checksum = sanitizePathSegment(attachment.checksum || "", "");
  const prefix = String((attachment.index || 0) + 1).padStart(3, "0");
  const storedFilename = checksum ? `${prefix}-${checksum.slice(0, 12)}-${safeName}` : `${prefix}-${safeName}`;

  return path.posix.join(
    resolveIssueStorageMonth(issueOrDate),
    sanitizePathSegment(issueId, "issue"),
    "attachments",
    storedFilename,
  );
}

function buildCommentFilename(comment: StorageComment, fallbackIndex: number) {
  const index = Number.isInteger(comment.index) ? comment.index! : fallbackIndex;
  const prefix = String(index + 1).padStart(3, "0");
  const hash = sanitizePathSegment(comment.hash || "", "");

  return hash ? `${prefix}-${hash.slice(0, 12)}.json` : `${prefix}.json`;
}

function writeJson(filePath: string, data: unknown) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function ensureIssueDirectory(options: StorageOptions, issueId: unknown, issueOrDate: unknown) {
  const paths = resolveIssuePaths(options, issueId, issueOrDate);
  mkdirSync(paths.issueDir, { recursive: true });
  return paths.issueDir;
}

export function writeIssueMirror(
  options: StorageOptions,
  issueId: unknown,
  issue: unknown,
  comments: StorageComment[],
) {
  const paths = resolveIssuePaths(options, issueId, issue);

  mkdirSync(paths.commentsDir, { recursive: true });
  mkdirSync(paths.attachmentsDir, { recursive: true });

  writeJson(paths.issueJson, issue);

  comments.forEach((comment, index: number) => {
    writeJson(path.join(paths.commentsDir, buildCommentFilename(comment, index)), comment);
  });

  return {
    issueDir: paths.issueDir,
    issueJson: paths.issueJson,
    commentsDir: paths.commentsDir,
    attachmentsDir: paths.attachmentsDir,
    comments: comments.length,
  };
}
