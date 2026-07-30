import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISSUES_ROOT = path.resolve(__dirname, "../../..");

function readOption(options, key) {
  return (
    options?.[key] ??
    options?.[key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())]
  );
}

function readConfiguredIssueDir(options) {
  const explicitDir = String(readOption(options, "issue-dir") || "").trim();
  if (explicitDir) return path.resolve(explicitDir);

  const envDir = String(process.env.ISSUE_DIR || "").trim();
  if (!envDir) return "";

  return path.isAbsolute(envDir) ? envDir : path.resolve(ISSUES_ROOT, envDir);
}

export function getIssueBaseDir(options) {
  const baseDir = readConfiguredIssueDir(options);
  if (!baseDir) {
    throw new Error(
      "Missing issue directory. Set ISSUE_DIR in biaws/.env or pass --issue-dir <path>.",
    );
  }

  return baseDir;
}

function sanitizePathSegment(value, fallback) {
  const sanitized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 160);

  return sanitized || fallback;
}

export function resolveIssueStorageMonth(issueOrDate) {
  const dates = issueOrDate?.dates || {};
  const candidates = [
    issueOrDate instanceof Date || typeof issueOrDate === "string"
      ? issueOrDate
      : null,
    dates.receivedEmailAt,
    dates.jiraCreatedAt,
    dates.firstThreadEmailAt,
    dates.issueCreatedAt,
    issueOrDate?.createdAt,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = candidate instanceof Date ? candidate : new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 7);
  }

  return new Date().toISOString().slice(0, 7);
}

function resolveIssuePaths(options, issueId, issueOrDate) {
  const baseDir = getIssueBaseDir(options);
  const month = resolveIssueStorageMonth(issueOrDate);
  const issueDir = path.join(
    baseDir,
    month,
    sanitizePathSegment(issueId, "issue"),
  );

  return {
    baseDir,
    issueDir,
    issueJson: path.join(issueDir, "issue.json"),
    commentsDir: path.join(issueDir, "comments"),
    attachmentsDir: path.join(issueDir, "attachments"),
  };
}

export function buildAttachmentStorageKey(issueId, attachment, issueOrDate) {
  const safeName = sanitizePathSegment(attachment.filename, "anexo");
  const checksum = sanitizePathSegment(attachment.checksum || "", "");
  const prefix = String((attachment.index || 0) + 1).padStart(3, "0");
  const storedFilename = checksum
    ? `${prefix}-${checksum.slice(0, 12)}-${safeName}`
    : `${prefix}-${safeName}`;

  return path.posix.join(
    resolveIssueStorageMonth(issueOrDate),
    sanitizePathSegment(issueId, "issue"),
    "attachments",
    storedFilename,
  );
}

function buildCommentFilename(comment, fallbackIndex) {
  const index = Number.isInteger(comment.index) ? comment.index : fallbackIndex;
  const prefix = String(index + 1).padStart(3, "0");
  const hash = sanitizePathSegment(comment.hash || "", "");

  return hash ? `${prefix}-${hash.slice(0, 12)}.json` : `${prefix}.json`;
}

function writeJson(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function ensureIssueDirectory(options, issueId, issueOrDate) {
  const paths = resolveIssuePaths(options, issueId, issueOrDate);
  mkdirSync(paths.issueDir, { recursive: true });
  return paths.issueDir;
}

export function writeIssueMirror(options, issueId, issue, comments) {
  const paths = resolveIssuePaths(options, issueId, issue);

  mkdirSync(paths.commentsDir, { recursive: true });
  mkdirSync(paths.attachmentsDir, { recursive: true });

  writeJson(paths.issueJson, issue);

  comments.forEach((comment, index) => {
    writeJson(
      path.join(paths.commentsDir, buildCommentFilename(comment, index)),
      comment,
    );
  });

  return {
    issueDir: paths.issueDir,
    issueJson: paths.issueJson,
    commentsDir: paths.commentsDir,
    attachmentsDir: paths.attachmentsDir,
    comments: comments.length,
  };
}
