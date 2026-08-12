import crypto from "node:crypto";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

const SKILLS_COLLECTION = COLLECTION_NAMES.SKILLS;
const SKILL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const MAX_FILES = 200;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDocument(document) {
  if (!document) return null;
  return { ...document, _id: document._id?.toString?.() ?? document._id };
}

function parseSemver(value) {
  const match = SEMVER_PATTERN.exec(String(value || "").trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || "",
  };
}

export function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return String(left).localeCompare(String(right));
  for (const field of ["major", "minor", "patch"]) {
    if (a[field] !== b[field]) return a[field] - b[field];
  }
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function normalizePath(value) {
  const filePath = String(value || "")
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

function normalizeFiles(files) {
  if (!Array.isArray(files) || !files.length) {
    throw createHttpError(
      422,
      "Invalid skill payload: files must be a non-empty array",
    );
  }
  if (files.length > MAX_FILES) {
    throw createHttpError(
      422,
      `Invalid skill payload: maximum of ${MAX_FILES} files`,
    );
  }

  const paths = new Set();
  let packageBytes = 0;
  const normalized = files
    .map((file) => {
      if (!file || typeof file !== "object" || Array.isArray(file)) {
        throw createHttpError(
          422,
          "Invalid skill payload: each file must be an object",
        );
      }
      const path = normalizePath(file.path);
      if (paths.has(path))
        throw createHttpError(422, `Duplicate skill file path: ${path}`);
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
        throw createHttpError(
          422,
          `Skill file exceeds ${MAX_FILE_BYTES} bytes: ${path}`,
        );
      }
      packageBytes += content.length;
      if (packageBytes > MAX_PACKAGE_BYTES) {
        throw createHttpError(
          422,
          `Skill package exceeds ${MAX_PACKAGE_BYTES} bytes`,
        );
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

function packageChecksum(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function normalizeSkillPayload(payload = {}) {
  const skillId = String(payload.skillId || payload.id || "").trim();
  const version = String(payload.version || "").trim();
  const name = String(payload.name || skillId).trim();
  const description = String(payload.description || "").trim();
  if (!SKILL_ID_PATTERN.test(skillId)) {
    throw createHttpError(
      422,
      "Invalid skill payload: skillId must use lowercase kebab-case",
    );
  }
  if (!parseSemver(version)) {
    throw createHttpError(
      422,
      "Invalid skill payload: version must use semantic versioning",
    );
  }
  if (!name)
    throw createHttpError(422, "Invalid skill payload: name is required");
  if (!description)
    throw createHttpError(
      422,
      "Invalid skill payload: description is required",
    );

  const files = normalizeFiles(payload.files);
  return {
    skillId,
    version,
    name,
    description,
    changelog: String(payload.changelog || "").trim(),
    compatibility:
      payload.compatibility && typeof payload.compatibility === "object"
        ? payload.compatibility
        : {},
    dependencies:
      payload.dependencies && typeof payload.dependencies === "object"
        ? payload.dependencies
        : {},
    files,
    packageSha256: packageChecksum(files),
    packageBytes: files.reduce((total, file) => total + file.size, 0),
  };
}

export function skillReplicationPayload(skill = {}) {
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

async function ensureIndexes(collection) {
  await Promise.all([
    collection.createIndex(
      { workspaceId: 1, skillId: 1, version: 1 },
      { unique: true },
    ),
    collection.createIndex({ workspaceId: 1, skillId: 1, createdAt: -1 }),
    collection.createIndex({ workspaceId: 1, status: 1 }),
    collection.createIndex({ workspaceId: 1, collectionId: 1 }),
  ]);
}

function workspaceId(query = {}) {
  return String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
}

function withoutFileContents(document) {
  if (!document) return null;
  const normalized = normalizeDocument(document);
  return {
    ...normalized,
    files: normalized.files?.map(({ contentBase64, ...file }) => file),
  };
}

export async function publishSkill(payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(SKILLS_COLLECTION);
  await ensureIndexes(collection);
  const normalized = normalizeSkillPayload(payload);
  const current = await collection.findOne({
    workspaceId: workspaceId(query),
    skillId: normalized.skillId,
  });
  const now = new Date();
  try {
    await collection.insertOne({
      ...normalized,
      workspaceId: workspaceId(query),
      collectionId:
        query.forceRootCollection === true
          ? ""
          : String(current?.collectionId || ""),
      status: "published",
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError(
        409,
        `Skill version already exists: ${normalized.skillId}@${normalized.version}`,
      );
    }
    throw error;
  }
  return getSkill(normalized.skillId, normalized.version, query);
}

export async function listSkills(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(SKILLS_COLLECTION);
  await ensureIndexes(collection);
  const documents = await collection
    .find({
      workspaceId: workspaceId(query),
      ...(query.includeDeprecated === "true" ? {} : { status: "published" }),
    })
    .project({ files: 0 })
    .toArray();
  const grouped = new Map();
  for (const document of documents) {
    const current = grouped.get(document.skillId);
    if (
      !current ||
      compareSemver(document.version, current.latestVersion) > 0
    ) {
      grouped.set(document.skillId, {
        skillId: document.skillId,
        name: document.name,
        description: document.description,
        collectionId: String(document.collectionId || ""),
        latestVersion: document.version,
        status: document.status,
        packageSha256: document.packageSha256,
        updatedAt: document.updatedAt,
        versions: [],
      });
    }
  }
  for (const document of documents) {
    grouped.get(document.skillId)?.versions.push({
      version: document.version,
      status: document.status,
      packageSha256: document.packageSha256,
      createdAt: document.createdAt,
    });
  }
  const items = [...grouped.values()]
    .map((item) => ({
      ...item,
      versions: item.versions.sort((a, b) =>
        compareSemver(b.version, a.version),
      ),
    }))
    .sort((a, b) => a.skillId.localeCompare(b.skillId));
  return {
    meta: {
      database: db.databaseName,
      collection: SKILLS_COLLECTION,
      total: items.length,
    },
    items,
  };
}

export async function getSkill(skillId, version, query = {}, options = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(SKILLS_COLLECTION);
  await ensureIndexes(collection);
  let document;
  if (version) {
    document = await collection.findOne({
      workspaceId: workspaceId(query),
      skillId: String(skillId),
      version: String(version),
    });
  } else {
    const candidates = await collection
      .find({
        skillId: String(skillId),
        workspaceId: workspaceId(query),
        ...(query.includeDeprecated === "true" ? {} : { status: "published" }),
      })
      .toArray();
    document = candidates.sort((a, b) =>
      compareSemver(b.version, a.version),
    )[0];
  }
  const skill = options.includeContents
    ? normalizeDocument(document)
    : withoutFileContents(document);
  return {
    meta: { database: db.databaseName, collection: SKILLS_COLLECTION },
    skill,
  };
}

export async function deprecateSkill(skillId, version, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const result = await db.collection(SKILLS_COLLECTION).updateOne(
    {
      workspaceId: workspaceId(query),
      skillId: String(skillId),
      version: String(version),
    },
    { $set: { status: "deprecated", updatedAt: new Date() } },
  );
  if (!result.matchedCount) {
    throw createHttpError(
      404,
      `Skill version not found: ${skillId}@${version}`,
    );
  }
  return getSkill(skillId, version, query);
}

export async function moveSkillToCollection(skillId, collectionId, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const currentWorkspaceId = workspaceId(query);
  const result = await db.collection(SKILLS_COLLECTION).updateMany(
    { workspaceId: currentWorkspaceId, skillId: String(skillId) },
    {
      $set: {
        collectionId: String(collectionId || ""),
        updatedAt: new Date(),
      },
    },
  );
  if (!result.matchedCount) {
    throw createHttpError(404, `Skill not found: ${skillId}`);
  }
  return getSkill(skillId, undefined, query);
}
