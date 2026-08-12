import crypto from "crypto";
import { ObjectId } from "mongodb";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import {
  buildAttachmentStorageKey,
  writeIssueMirror,
} from "../helpers/issueStorage.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { getIssue } from "../repositories/issuesRepository.js";
import { getDocument } from "../repositories/documentsRepository.js";
import { getRequest } from "../repositories/requestsRepository.js";
import {
  buildKnowledgeContextFilter,
  knowledgeContextMetadata,
} from "../repositories/knowledgeContextRepository.js";
import { createAttachmentStorage } from "../storage/attachmentStorage.js";

const ENTITY_CONFIG = {
  issues: {
    collection: COLLECTION_NAMES.ISSUES,
    directoryEnv: "ISSUE_DIR",
    filter: (id) => ({ id }),
    read: (id, query) => getIssue(id, query),
    resultKey: "issue",
    mirror(result, id) {
      writeIssueMirror({}, id, result.issue, result.comments);
    },
  },
  documents: {
    collection: COLLECTION_NAMES.DOCUMENTS,
    directoryEnv: "DOCUMENT_DIR",
    fallbackDirectoryEnv: "PROCEDURE_DIR",
    filter: (id) => ({ id }),
    read: (id, query) => getDocument(id, query),
    resultKey: "document",
  },
  requests: {
    collection: COLLECTION_NAMES.REQUESTS,
    directoryEnv: "REQUEST_DIR",
    filter(id) {
      if (!ObjectId.isValid(id))
        throw createHttpError(422, `Invalid request id: ${id}`);
      return { _id: new ObjectId(id) };
    },
    read: (id, query) => getRequest(id, query),
    resultKey: "request",
  },
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function entityConfig(entityType) {
  const config = ENTITY_CONFIG[entityType];
  if (!config)
    throw createHttpError(404, `Unsupported attachment entity: ${entityType}`);
  return config;
}

function storageOptions(config, provider) {
  const localDir = String(
    process.env[config.directoryEnv] ||
      process.env[config.fallbackDirectoryEnv] ||
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

function findAttachment(document, attachmentId) {
  const value = String(attachmentId || "");
  return (document.attachments || []).find(
    (attachment) =>
      attachment.id === value || String(attachment.index) === value,
  );
}

function storageReference(attachment) {
  const provider =
    attachment.storage?.provider ||
    (attachment.storage?.type === "local-file" ? "local" : "");
  const key = attachment.storage?.key || attachment.storage?.relativePath;
  if (!provider || !key) {
    throw createHttpError(
      404,
      "Attachment content is not available in storage",
    );
  }
  return { provider, key };
}

function nextAttachmentIndex(attachments) {
  return (
    attachments.reduce(
      (maximum, attachment) =>
        Number.isInteger(attachment.index)
          ? Math.max(maximum, attachment.index)
          : maximum,
      -1,
    ) + 1
  );
}

function normalizeTags(value) {
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
  if (tags.length > 20)
    throw createHttpError(422, "An attachment can have at most 20 tags");
  if (tags.some((tag) => tag.length > 40)) {
    throw createHttpError(
      422,
      "Attachment tags can have at most 40 characters",
    );
  }
  return tags;
}

function parseUploadTags(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return normalizeTags(value);
  try {
    return normalizeTags(JSON.parse(String(value)));
  } catch (error) {
    if (error.statusCode) throw error;
    return normalizeTags(String(value).split(","));
  }
}

export function normalizeUploadFilename(value) {
  const original = String(value || "anexo");
  const canBeLatin1 = [...original].every(
    (character) => character.codePointAt(0) <= 0xff,
  );
  const utf8Candidate = canBeLatin1
    ? Buffer.from(original, "latin1").toString("utf8")
    : original;
  const decoded = utf8Candidate.includes("\uFFFD") ? original : utf8Candidate;
  return decoded.normalize("NFC");
}

export async function uploadAttachments(
  entityType,
  entityId,
  files,
  query = {},
  tags = [],
) {
  if (!files?.length)
    throw createHttpError(422, "Multipart field 'files' is required");

  const config = entityConfig(entityType);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = {
    ...config.filter(entityId),
    ...buildKnowledgeContextFilter(query),
  };
  const document = await db.collection(config.collection).findOne(filter);
  if (!document)
    throw createHttpError(404, `${config.resultKey} not found: ${entityId}`);

  const storage = createAttachmentStorage(storageOptions(config));
  await storage.initialize();
  const defaultTags = parseUploadTags(tags);
  let index = nextAttachmentIndex(document.attachments || []);
  const stored = [];

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

    await db.collection(config.collection).updateOne(filter, {
      $push: { attachments: { $each: stored } },
      $set: { updatedAt: new Date() },
    });
  } catch (error) {
    await Promise.allSettled(
      stored.map((attachment) =>
        storage.delete({ key: attachment.storage.key }),
      ),
    );
    throw error;
  }

  const result = await config.read(entityId, query);
  config.mirror?.(result, entityId);
  return { ...result, uploaded: stored };
}

export async function readAttachment(
  entityType,
  entityId,
  attachmentId,
  query = {},
) {
  const config = entityConfig(entityType);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const document = await db.collection(config.collection).findOne({
    ...config.filter(entityId),
    ...buildKnowledgeContextFilter(query),
  });
  if (!document)
    throw createHttpError(404, `${config.resultKey} not found: ${entityId}`);

  const attachment = findAttachment(document, attachmentId);
  if (!attachment)
    throw createHttpError(404, `Attachment not found: ${attachmentId}`);

  const reference = storageReference(attachment);
  const storage = createAttachmentStorage(
    storageOptions(config, reference.provider),
  );
  try {
    return { attachment, content: await storage.read({ key: reference.key }) };
  } catch (error) {
    if (error.code === "ENOENT") {
      throw createHttpError(
        404,
        `Attachment file not found: ${attachment.filename}`,
      );
    }
    throw error;
  }
}

export async function deleteAttachment(
  entityType,
  entityId,
  attachmentId,
  query = {},
) {
  const config = entityConfig(entityType);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = {
    ...config.filter(entityId),
    ...buildKnowledgeContextFilter(query),
  };
  const document = await db.collection(config.collection).findOne(filter);
  if (!document)
    throw createHttpError(404, `${config.resultKey} not found: ${entityId}`);

  const attachment = findAttachment(document, attachmentId);
  if (!attachment)
    throw createHttpError(404, `Attachment not found: ${attachmentId}`);

  const reference = storageReference(attachment);
  const attachmentFilter = attachment.id
    ? { id: attachment.id }
    : { index: attachment.index };
  const result = await db.collection(config.collection).updateOne(filter, {
    $pull: { attachments: attachmentFilter },
    $set: { updatedAt: new Date() },
  });
  if (!result.modifiedCount) {
    throw createHttpError(409, "Attachment was not removed from the document");
  }

  const storage = createAttachmentStorage(
    storageOptions(config, reference.provider),
  );
  let fileDeleted = false;
  let fileDeleteError = "";
  try {
    fileDeleted = await storage.delete({ key: reference.key });
  } catch (error) {
    fileDeleteError = error.message;
  }

  const details = await config.read(entityId, query);
  config.mirror?.(details, entityId);
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

export async function updateAttachmentTags(
  entityType,
  entityId,
  attachmentId,
  tags,
  query = {},
) {
  const config = entityConfig(entityType);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = {
    ...config.filter(entityId),
    ...buildKnowledgeContextFilter(query),
  };
  const document = await db.collection(config.collection).findOne(filter);
  if (!document)
    throw createHttpError(404, `${config.resultKey} not found: ${entityId}`);

  const attachment = findAttachment(document, attachmentId);
  if (!attachment)
    throw createHttpError(404, `Attachment not found: ${attachmentId}`);

  const normalizedTags = normalizeTags(tags);
  const nextAttachments = (document.attachments || []).map((item) =>
    item === attachment ? { ...item, tags: normalizedTags } : item,
  );
  await db.collection(config.collection).updateOne(filter, {
    $set: {
      attachments: nextAttachments,
      updatedAt: new Date(),
    },
  });

  const details = await config.read(entityId, query);
  config.mirror?.(details, entityId);
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
