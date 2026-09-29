import { textValue } from "../../helpers/text.js";
import { WithId, Document } from "mongodb";
import type { SkillDocument, PublicSkillDocument } from "../../types/skills.js";
import { SEMVER_PATTERN, MAX_FILES, MAX_FILE_BYTES, MAX_PACKAGE_BYTES, SKILL_ID_PATTERN } from "./constants.js";
import { createHttpError } from "./support.js";
import crypto from "node:crypto";

function normalizeDocumentValue(document: WithId<Document> | null) {
  if (!document) return null;
  return { ...document, _id: document._id?.toString?.() ?? document._id };
}

function parseSemver(value: string) {
  const match = SEMVER_PATTERN.exec(String(value || "").trim());
  if (!match || match.slice(1, 4).some((part) => part.length > 1 && part.startsWith("0"))) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || "",
  };
}

export function compareSemver(left: string, right: string) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return String(left).localeCompare(String(right));
  for (const field of ["major", "minor", "patch"] as const) {
    if (a[field] !== b[field]) return a[field] - b[field];
  }
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function normalizePath(value: unknown) {
  const filePath = textValue(value || "")
    .replaceAll("\\", "/")
    .trim();
  if (
    !filePath ||
    filePath.startsWith("/") ||
    filePath.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw createHttpError(422, `Invalid skill file path: ${value}`);
  }
  return filePath;
}

function normalizeFiles(files: unknown) {
  if (!Array.isArray(files) || !files.length) {
    throw createHttpError(422, "Invalid skill payload: files must be a non-empty array");
  }
  if (files.length > MAX_FILES) {
    throw createHttpError(422, `Invalid skill payload: maximum of ${MAX_FILES} files`);
  }

  const paths = new Set();
  let packageBytes = 0;
  const normalized = files
    .map((file) => {
      if (!file || typeof file !== "object" || Array.isArray(file)) {
        throw createHttpError(422, "Invalid skill payload: each file must be an object");
      }
      const path = normalizePath(file.path);
      if (paths.has(path)) throw createHttpError(422, `Duplicate skill file path: ${path}`);
      paths.add(path);

      let content;
      if (typeof file.contentBase64 === "string") {
        content = Buffer.from(file.contentBase64, "base64");
      } else if (typeof file.content === "string") {
        content = Buffer.from(file.content, "utf8");
      } else {
        throw createHttpError(422, `Invalid skill file content: ${path}`);
      }
      if (content.length > MAX_FILE_BYTES) {
        throw createHttpError(422, `Skill file exceeds ${MAX_FILE_BYTES} bytes: ${path}`);
      }
      packageBytes += content.length;
      if (packageBytes > MAX_PACKAGE_BYTES) {
        throw createHttpError(422, `Skill package exceeds ${MAX_PACKAGE_BYTES} bytes`);
      }
      return {
        path,
        contentBase64: content.toString("base64"),
        size: content.length,
        sha256: crypto.createHash("sha256").update(content).digest("hex"),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  if (!paths.has("SKILL.md")) {
    throw createHttpError(422, "Invalid skill payload: SKILL.md is required");
  }
  return normalized;
}

function packageChecksum(
  files: {
    path: string;
    contentBase64: string;
    size: number;
    sha256: string;
  }[],
) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function normalizeSkillPayload(payload: Record<string, unknown> = {}) {
  const skillId = textValue(payload.skillId || payload.id || "").trim();
  const version = textValue(payload.version || "").trim();
  const name = textValue(payload.name || skillId).trim();
  const description = textValue(payload.description || "").trim();
  if (!SKILL_ID_PATTERN.test(skillId)) {
    throw createHttpError(422, "Invalid skill payload: skillId must use lowercase kebab-case");
  }
  if (!parseSemver(version)) {
    throw createHttpError(422, "Invalid skill payload: version must use semantic versioning");
  }
  if (!name) throw createHttpError(422, "Invalid skill payload: name is required");
  if (!description) throw createHttpError(422, "Invalid skill payload: description is required");

  const files = normalizeFiles(payload.files);
  return {
    skillId,
    version,
    name,
    description,
    changelog: textValue(payload.changelog || "").trim(),
    compatibility: payload.compatibility && typeof payload.compatibility === "object" ? payload.compatibility : {},
    dependencies: payload.dependencies && typeof payload.dependencies === "object" ? payload.dependencies : {},
    files,
    packageSha256: packageChecksum(files),
    packageBytes: files.reduce((total, file) => total + file.size, 0),
  };
}

export function skillReplicationPayload<T extends Partial<ReturnType<typeof normalizeSkillPayload>>>(skill: T) {
  return {
    skillId: skill.skillId,
    version: skill.version,
    name: skill.name,
    description: skill.description,
    changelog: skill.changelog,
    compatibility: skill.compatibility,
    dependencies: skill.dependencies,
    files: (skill.files || []).map(({ path, contentBase64 }) => ({
      path,
      contentBase64,
    })),
  };
}

export function withoutFileContents(document: WithId<SkillDocument> | null) {
  if (!document) return null;
  const normalized = normalizeDocument(document);
  return {
    ...normalized,
    files: document.files?.map(({ contentBase64, ...file }) => file),
  };
}

export function normalizeDocument(document: WithId<SkillDocument>): PublicSkillDocument;
export function normalizeDocument(document: WithId<SkillDocument> | null): PublicSkillDocument | null;
export function normalizeDocument(
  document: NonNullable<Parameters<typeof normalizeDocumentValue>[0]>,
): NonNullable<ReturnType<typeof normalizeDocumentValue>>;
export function normalizeDocument(
  document: Parameters<typeof normalizeDocumentValue>[0],
): ReturnType<typeof normalizeDocumentValue>;
export function normalizeDocument(document: Parameters<typeof normalizeDocumentValue>[0]) {
  return normalizeDocumentValue(document);
}
