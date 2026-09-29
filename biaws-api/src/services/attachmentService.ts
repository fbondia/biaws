import type { UpdateFilter } from "mongodb";
import { ObjectId } from "mongodb";
import crypto from "node:crypto";
import { errorCode, errorMessage } from "../helpers/error.js";
import { textValue } from "../helpers/text.js";
import { resolveEntityReference } from "../repositories/shared/references.js";
interface AttachmentStorageRef {
  provider?: string;
  type?: string;
  key?: string;
  relativePath?: string;
  saved?: boolean;
}
interface StoredAttachment {
  id?: string;
  index: number;
  filename: string;
  contentType: string;
  size: number;
  checksum?: string;
  tags?: string[];
  storage?: AttachmentStorageRef;
  [field: string]: unknown;
}
type StoredNowAttachment = StoredAttachment & {
  storage: AttachmentStorageRef & { key: string };
};
interface AttachmentDocument extends Document {
  id?: string;
  workspaceId?: string;
  applicationId?: string | null;
  affectedComponentIds?: string[];
  attachments?: StoredAttachment[];
  createdAt?: Date;
  dates?: Record<string, Date | string | number | null | undefined>;
}
type EntityType = "issues" | "documents" | "requests";

import { Document } from "bson";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { buildAttachmentStorageKey, writeIssueMirror } from "../helpers/issueStorage.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { getDocument } from "../repositories/documents/index.js";
import { getIssue } from "../repositories/issues/index.js";
import { getRequest } from "../repositories/requests/index.js";
import { buildKnowledgeContextFilter, knowledgeContextMetadata } from "../repositories/shared/knowledgeContext.js";
import { createAttachmentStorage } from "../storage/attachmentStorage.js";
import type { RepositoryQuery } from "../types/http.js";

const ENTITY_CONFIG = {
  issues: {
    collection: COLLECTION_NAMES.ISSUES,
    directoryEnv: "BIAWS_ISSUE_DIR",
    filter: (id: string) => ({ id }),
    read: (id: string | string[], query: RepositoryQuery | undefined) => getIssue(id, query),
    resultKey: "issue",
    mirror(result: Awaited<ReturnType<typeof getIssue>>, id: string) {
      if (!result.issue) throw new Error("Issue mirror is unavailable");
      writeIssueMirror(
        {},
        id,
        result.issue,
        result.comments.filter((comment) => comment !== null),
      );
    },
  },
  documents: {
    collection: COLLECTION_NAMES.DOCUMENTS,
    directoryEnv: "BIAWS_DOCUMENT_DIR",
    fallbackDirectoryEnv: "PROCEDURE_DIR",
    filter: (id: string) => ({ id }),
    read: (id: string | string[], query: RepositoryQuery | undefined) => getDocument(id, query),
    resultKey: "document",
  },
  requests: {
    collection: COLLECTION_NAMES.REQUESTS,
    directoryEnv: "BIAWS_REQUEST_DIR",
    filter(id: string) {
      if (!ObjectId.isValid(id)) throw createHttpError(422, `Invalid request id: ${id}`);
      return { _id: new ObjectId(id) };
    },
    read: (id: string | string[], query: RepositoryQuery | undefined) => getRequest(id, query),
    resultKey: "request",
  },
};

function createHttpError(statusCode: number | undefined, message: string | undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function entityConfig(entityType: EntityType) {
  const config = ENTITY_CONFIG[entityType];
  if (!config) throw createHttpError(404, `Unsupported attachment entity: ${entityType}`);
  return config;
}

function storageOptions(config: { directoryEnv: string; fallbackDirectoryEnv?: string }, provider?: string) {
  const localDir = String(
    process.env[config.directoryEnv] ||
      (config.fallbackDirectoryEnv ? process.env[config.fallbackDirectoryEnv] : undefined) ||
      "",
  ).trim();
  if (!localDir) {
    throw new Error(`Missing attachment directory: set ${config.directoryEnv}`);
  }
  return {
    attachmentStorageLocalDir: localDir,
    ...(provider ? { attachmentStorageProvider: provider } : {}),
  };
}

function findAttachment(document: AttachmentDocument, attachmentId: string | string[]) {
  const value = String(attachmentId || "");
  return (document.attachments || []).find(
    (attachment) => attachment.id === value || String(attachment.index) === value,
  );
}

function storageReference(attachment: StoredAttachment) {
  const provider = attachment.storage?.provider || (attachment.storage?.type === "local-file" ? "local" : "");
  const key = attachment.storage?.key || attachment.storage?.relativePath;
  if (!provider || !key) {
    throw createHttpError(404, "Attachment content is not available in storage");
  }
  return { provider, key };
}

function nextAttachmentIndex(attachments: StoredAttachment[]) {
  return (
    attachments.reduce(
      (maximum: number, attachment: StoredAttachment) =>
        Number.isInteger(attachment.index) ? Math.max(maximum, attachment.index) : maximum,
      -1,
    ) + 1
  );
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    throw createHttpError(422, "Attachment tags must be an array");
  }
  const tags = [
    ...new Set(
      value
        .map((tag) =>
          String(tag || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ];
  if (tags.length > 20) throw createHttpError(422, "An attachment can have at most 20 tags");
  if (tags.some((tag) => tag.length > 40)) {
    throw createHttpError(422, "Attachment tags can have at most 40 characters");
  }
  return tags;
}

export function parseUploadTags(value: unknown) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return normalizeTags(value);
  try {
    return normalizeTags(JSON.parse(textValue(value)));
  } catch (error) {
    if (error instanceof Error && error.statusCode) throw error;
    return normalizeTags(textValue(value).split(","));
  }
}

export function normalizeUploadFilename(value: string) {
  const original = String(value || "anexo");
  const canBeLatin1 = [...original].every((character) => (character.codePointAt(0) ?? 0) <= 0xff);
  const utf8Candidate = canBeLatin1 ? Buffer.from(original, "latin1").toString("utf8") : original;
  const decoded = utf8Candidate.includes("\uFFFD") ? original : utf8Candidate;
  return decoded.normalize("NFC");
}

export async function uploadAttachments(
  entityType: EntityType,
  entityId: string,
  files: Express.Multer.File[],
  query: RepositoryQuery = {},
  tags: unknown = [],
) {
  if (!files?.length) throw createHttpError(422, "Multipart field 'files' is required");

  const config = entityConfig(entityType);
  entityId = await resolveEntityReference(referenceEntityType(entityType), entityId, query);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = {
    ...config.filter(entityId),
    ...buildKnowledgeContextFilter(query),
  };
  const document = await db.collection<AttachmentDocument>(config.collection).findOne(filter);
  if (!document) throw createHttpError(404, `${config.resultKey} not found: ${entityId}`);

  const storage = createAttachmentStorage(storageOptions(config));
  await storage.initialize();
  const defaultTags = parseUploadTags(tags);
  let index = nextAttachmentIndex(document.attachments || []);
  const stored: StoredNowAttachment[] = [];

  try {
    for (const file of files) {
      const attachment = {
        id: crypto.randomUUID(),
        index,
        filename: normalizeUploadFilename(file.originalname),
        contentType: file.mimetype || "application/octet-stream",
        size: file.size,
        checksum: crypto.createHash("sha256").update(file.buffer).digest("hex"),
        contentDisposition: "attachment",
        uploadedAt: new Date(),
        source: { kind: "ui-upload", entityType },
        tags: defaultTags,
        context: knowledgeContextMetadata(document),
      };
      const key = buildAttachmentStorageKey(entityId, attachment, document);
      const reference = await storage.save({ key, content: file.buffer });
      stored.push({
        ...attachment,
        storage: { ...reference, relativePath: reference.key },
      });
      index += 1;
    }

    await db.collection<AttachmentDocument>(config.collection).updateOne(filter, {
      $push: { attachments: { $each: stored } },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<AttachmentDocument>);
  } catch (error) {
    await Promise.allSettled(stored.map((attachment) => storage.delete({ key: attachment.storage.key })));
    throw error;
  }

  const result = await config.read(entityId, query);
  if (entityType === "issues") ENTITY_CONFIG.issues.mirror(result as Awaited<ReturnType<typeof getIssue>>, entityId);
  return {
    ...result,
    uploaded: stored.map(({ storage: _storage, ...attachment }) => attachment),
  };
}

export async function readAttachment(
  entityType: EntityType,
  entityId: string | string[],
  attachmentId: string | string[],
  query: RepositoryQuery = {},
) {
  const config = entityConfig(entityType);
  entityId = await resolveEntityReference(referenceEntityType(entityType), entityId, query);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const document = await db.collection<AttachmentDocument>(config.collection).findOne({
    ...config.filter(entityId),
    ...buildKnowledgeContextFilter(query),
  });
  if (!document) throw createHttpError(404, `${config.resultKey} not found: ${entityId}`);

  const attachment = findAttachment(document, attachmentId);
  if (!attachment) throw createHttpError(404, `Attachment not found: ${attachmentId}`);

  const reference = storageReference(attachment);
  const storage = createAttachmentStorage(storageOptions(config, reference.provider));
  try {
    return { attachment, content: await storage.read({ key: reference.key }) };
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw createHttpError(404, `Attachment file not found: ${attachment.filename}`);
    }
    throw error;
  }
}

export async function deleteAttachment(
  entityType: EntityType,
  entityId: string | string[],
  attachmentId: string | string[],
  query: RepositoryQuery = {},
) {
  const config = entityConfig(entityType);
  entityId = await resolveEntityReference(referenceEntityType(entityType), entityId, query);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = {
    ...config.filter(entityId),
    ...buildKnowledgeContextFilter(query),
  };
  const document = await db.collection<AttachmentDocument>(config.collection).findOne(filter);
  if (!document) throw createHttpError(404, `${config.resultKey} not found: ${entityId}`);

  const attachment = findAttachment(document, attachmentId);
  if (!attachment) throw createHttpError(404, `Attachment not found: ${attachmentId}`);

  const reference = storageReference(attachment);
  const attachmentFilter = attachment.id ? { id: attachment.id } : { index: attachment.index };
  const result = await db.collection<AttachmentDocument>(config.collection).updateOne(filter, {
    $pull: { attachments: attachmentFilter },
    $set: { updatedAt: new Date() },
  } as unknown as UpdateFilter<AttachmentDocument>);
  if (!result.modifiedCount) {
    throw createHttpError(409, "Attachment was not removed from the document");
  }

  const storage = createAttachmentStorage(storageOptions(config, reference.provider));
  let fileDeleted = false;
  let fileDeleteError = "";
  try {
    fileDeleted = await storage.delete({ key: reference.key });
  } catch (error) {
    fileDeleteError = errorMessage(error);
  }

  const details = await config.read(entityId, query);
  if (entityType === "issues") ENTITY_CONFIG.issues.mirror(details as Awaited<ReturnType<typeof getIssue>>, entityId);
  return {
    ...details,
    deleted: {
      id: attachment.id || null,
      index: attachment.index,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      tags: attachment.tags || [],
      fileDeleted,
      ...(fileDeleteError ? { fileDeleteError } : {}),
    },
  };
}

export async function deleteStoredAttachments(entityType: EntityType, document: { attachments?: unknown[] }) {
  const config = entityConfig(entityType);
  const attachments = (document?.attachments || []) as StoredAttachment[];
  const results = await Promise.allSettled(
    attachments.map(async (attachment) => {
      const reference = storageReference(attachment);
      const storage = createAttachmentStorage(storageOptions(config, reference.provider));
      return {
        attachment,
        deleted: await storage.delete({ key: reference.key }),
      };
    }),
  );
  const failures = results.flatMap((result, index: number) =>
    result.status === "rejected"
      ? [
          {
            attachmentId: attachments[index]?.id ?? attachments[index]?.index ?? null,
            filename: attachments[index]?.filename || "",
            message: errorMessage(result.reason) || "Falha ao excluir o arquivo",
          },
        ]
      : [],
  );
  return {
    attempted: attachments.length,
    deleted: results.filter((result) => result.status === "fulfilled" && result.value.deleted).length,
    failures,
  };
}

export async function updateAttachmentTags(
  entityType: EntityType,
  entityId: string | string[],
  attachmentId: string | string[],
  tags: string[],
  query: RepositoryQuery = {},
) {
  const config = entityConfig(entityType);
  entityId = await resolveEntityReference(referenceEntityType(entityType), entityId, query);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = {
    ...config.filter(entityId),
    ...buildKnowledgeContextFilter(query),
  };
  const document = await db.collection<AttachmentDocument>(config.collection).findOne(filter);
  if (!document) throw createHttpError(404, `${config.resultKey} not found: ${entityId}`);

  const attachment = findAttachment(document, attachmentId);
  if (!attachment) throw createHttpError(404, `Attachment not found: ${attachmentId}`);

  const normalizedTags = normalizeTags(tags);
  const nextAttachments = (document.attachments || []).map((item) =>
    item === attachment ? { ...item, tags: normalizedTags } : item,
  );
  await db.collection<AttachmentDocument>(config.collection).updateOne(filter, {
    $set: {
      attachments: nextAttachments,
      updatedAt: new Date(),
    },
  });

  const details = await config.read(entityId, query);
  if (entityType === "issues") ENTITY_CONFIG.issues.mirror(details as Awaited<ReturnType<typeof getIssue>>, entityId);
  return {
    ...details,
    attachment: {
      id: attachment.id || null,
      index: attachment.index,
      filename: attachment.filename,
      previousTags: attachment.tags || [],
      tags: normalizedTags,
    },
  };
}

function referenceEntityType(entityType: EntityType) {
  if (entityType === "requests") return "demand";
  if (entityType === "issues") return "issue";
  return "document";
}
