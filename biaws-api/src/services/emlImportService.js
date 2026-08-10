import { parseEmlBuffer } from "../helpers/emailParser.js";
import {
  buildAttachmentStorageKey,
  ensureIssueDirectory,
  writeIssueMirror,
} from "../helpers/issueStorage.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { createAttachmentStorage } from "../storage/attachmentStorage.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { normalizeClassificationPayload } from "../helpers/issueClassification.js";
import { assertTaxonomyIdsApplicable } from "../helpers/taxonomy.js";
import {
  DEFAULT_ISSUE_STATUS,
  DEFAULT_ISSUE_TYPE,
} from "../../../shared/issueConstants.js";
import {
  activeValues,
  getIssueOptionLists,
} from "../repositories/optionListsRepository.js";
import {
  buildKnowledgeContextFilter,
  knowledgeContextMetadata,
  resolveKnowledgeContext,
} from "../repositories/knowledgeContextRepository.js";
import { getEmailSanitizationConfiguration } from "../repositories/emailSanitizationRepository.js";

const ISSUES_COLLECTION = COLLECTION_NAMES.ISSUES;
const COMMENTS_COLLECTION = COLLECTION_NAMES.ISSUE_COMMENTS;
const SYNTHETIC_ISSUE_ID_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{3}$/u;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeTitle(title) {
  return String(title || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function selectDedupeDate(parsedIssue) {
  return (
    parseDate(parsedIssue.dates?.receivedEmailAt) ||
    parseDate(parsedIssue.dates?.firstThreadEmailAt) ||
    parseDate(parsedIssue.dates?.issueCreatedAt)
  );
}

function buildDedupeKey(parsedIssue) {
  const title = normalizeTitle(parsedIssue.title);
  const date = selectDedupeDate(parsedIssue);
  if (!title || !date) return "";

  const hasEmailDate = Boolean(
    parseDate(parsedIssue.dates?.receivedEmailAt) ||
    parseDate(parsedIssue.dates?.firstThreadEmailAt),
  );
  return `${hasEmailDate ? date.toISOString() : formatDateLabel(date)}|${title}`;
}

function buildDateRange(date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { $gte: start, $lt: end };
}

async function findExistingSyntheticIssueId(db, parsedIssue) {
  const title = String(parsedIssue.title || "").trim();
  const receivedEmailAt = parseDate(parsedIssue.dates?.receivedEmailAt);
  const firstThreadEmailAt = parseDate(parsedIssue.dates?.firstThreadEmailAt);
  const issueCreatedAt = parseDate(parsedIssue.dates?.issueCreatedAt);
  const dedupeKey = buildDedupeKey(parsedIssue);
  const matches = [];

  if (dedupeKey) matches.push({ "source.dedupeKey": dedupeKey });
  if (title && receivedEmailAt)
    matches.push({ title, "dates.receivedEmailAt": receivedEmailAt });
  if (title && firstThreadEmailAt) {
    matches.push({ title, "dates.firstThreadEmailAt": firstThreadEmailAt });
  }
  if (title && !receivedEmailAt && !firstThreadEmailAt && issueCreatedAt) {
    matches.push({
      title,
      "dates.issueCreatedAt": buildDateRange(issueCreatedAt),
    });
  }
  if (!matches.length) return "";

  const existing = await db
    .collection(ISSUES_COLLECTION)
    .findOne(
      { id: { $regex: SYNTHETIC_ISSUE_ID_PATTERN }, $or: matches },
      { projection: { id: 1 }, sort: { "dates.issueCreatedAt": 1, id: 1 } },
    );
  return existing?.id || "";
}

async function generateIssueId(db, date = new Date()) {
  const prefix = `${formatDateLabel(date)}-`;
  const existing = await db
    .collection(ISSUES_COLLECTION)
    .find({ id: { $regex: `^${prefix}\\d{3}$` } })
    .project({ id: 1 })
    .sort({ id: -1 })
    .limit(1)
    .toArray();
  const lastSequence =
    Number((existing[0]?.id || "").slice(prefix.length)) || 0;
  return `${prefix}${String(lastSequence + 1).padStart(3, "0")}`;
}

async function resolveIssueId(db, parsedIssue, explicitId) {
  if (explicitId) return explicitId;
  if (parsedIssue.idFromSubject) return parsedIssue.idFromSubject;
  return (
    (await findExistingSyntheticIssueId(db, parsedIssue)) ||
    generateIssueId(db, parsedIssue.dates.issueCreatedAt)
  );
}

function buildIssueDocument(parsedIssue, issueId, status, context) {
  return {
    id: issueId,
    ...context,
    type: parsedIssue.type,
    title: parsedIssue.title,
    text: parsedIssue.text,
    dates: parsedIssue.dates,
    status,
    source: {
      file: parsedIssue.sourceFile,
      messageId: parsedIssue.sourceMessageId,
      inReplyTo: parsedIssue.sourceInReplyTo,
      references: parsedIssue.sourceReferences,
      dedupeKey: buildDedupeKey(parsedIssue),
      dedupeStrategy: "synthetic-id-email-date-title",
    },
    attachments: (parsedIssue.attachments || []).map((attachment) => ({
      ...attachment,
      context: knowledgeContextMetadata(context),
    })),
    updatedAt: new Date(),
  };
}

function buildCommentDocument(parsedIssue, issueId, message) {
  return {
    issueId,
    hash: message.hash,
    text: message.text,
    from: message.from,
    to: message.to,
    cc: message.cc,
    date: message.date,
    rawDate: message.rawDate,
    index: message.index,
    source: {
      file: parsedIssue.sourceFile,
      messageId: parsedIssue.sourceMessageId,
    },
    createdAt: new Date(),
  };
}

export function attachmentDedupeKey(attachment = {}) {
  const checksum = String(attachment.checksum || "")
    .trim()
    .toLowerCase();
  if (checksum) return `checksum:${checksum}`;
  const filename = String(attachment.filename || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
  const contentType = String(attachment.contentType || "")
    .trim()
    .toLowerCase();
  return `metadata:${filename}|${Number(attachment.size) || 0}|${contentType}`;
}

function mergeTags(first = [], second = []) {
  const tags = new Map();
  for (const tag of [...first, ...second]) {
    const value = String(tag || "").trim();
    if (value) tags.set(value.toLowerCase(), value);
  }
  return [...tags.values()];
}

function mergeExistingAttachments(attachments = []) {
  const merged = [];
  const byKey = new Map();
  for (const attachment of attachments) {
    const key = attachmentDedupeKey(attachment);
    const existingIndex = byKey.get(key);
    if (existingIndex === undefined) {
      byKey.set(key, merged.length);
      merged.push({ ...attachment, tags: [...(attachment.tags || [])] });
    } else {
      merged[existingIndex] = {
        ...merged[existingIndex],
        tags: mergeTags(merged[existingIndex].tags, attachment.tags),
      };
    }
  }
  return { merged, byKey };
}

async function planImport(
  db,
  parsedIssue,
  explicitId,
  status,
  contextPayload,
  authorizationScope,
) {
  const issueId = await resolveIssueId(db, parsedIssue, explicitId);
  const existingIssue = await db.collection(ISSUES_COLLECTION).findOne({
    id: issueId,
    ...buildKnowledgeContextFilter({ authorizationScope }),
  });
  const hashes = parsedIssue.messages.map((message) => message.hash);
  const existingComments = hashes.length
    ? await db
        .collection(COMMENTS_COLLECTION)
        .countDocuments({ issueId, hash: { $in: hashes } })
    : 0;
  const context = await resolveKnowledgeContext(
    db,
    contextPayload,
    existingIssue,
    {
      applicationRequired: true,
      authorizationScope,
      create: !existingIssue,
    },
  );
  const issue = buildIssueDocument(parsedIssue, issueId, status, context);

  return {
    issueId,
    existingIssue,
    issue,
    comments: {
      total: parsedIssue.messages.length,
      new: parsedIssue.messages.length - existingComments,
      duplicates: existingComments,
    },
  };
}

function validateOptions({ explicitId, title, type }) {
  const normalizedType = String(type || "").trim();
  const normalizedTitle = String(title || "").trim();
  return {
    explicitId: String(explicitId || "").trim(),
    title: normalizedTitle || undefined,
    type: normalizedType || undefined,
  };
}

function validateImportFile(content, options) {
  if (!Buffer.isBuffer(content) || !content.length) {
    throw createHttpError(422, "Invalid EML import: file is required");
  }
  const sourceFile =
    String(options.filename || "email.eml").trim() || "email.eml";
  if (!sourceFile.toLowerCase().endsWith(".eml")) {
    throw createHttpError(
      422,
      "Invalid EML import: filename must end with .eml",
    );
  }
  return sourceFile;
}

async function prepareImport(content, options) {
  const { explicitId, title, type } = validateOptions(options);
  const sourceFile = validateImportFile(content, options);
  const db = await getMongoDatabase(options);
  const optionLists = await getIssueOptionLists({
    db: db.databaseName,
    authorizationScope: options.authorizationScope,
    workspaceId: options.workspaceId,
  });
  const issueTypes = activeValues(optionLists.types);
  const issueStatuses = activeValues(optionLists.statuses);
  const defaultType =
    optionLists.types?.defaultValue || issueTypes[0] || DEFAULT_ISSUE_TYPE;
  const defaultStatus =
    optionLists.statuses?.defaultValue ||
    issueStatuses[0] ||
    DEFAULT_ISSUE_STATUS;

  if (type && !issueTypes.includes(type)) {
    throw createHttpError(
      422,
      `Invalid EML import: type must be one of ${issueTypes.join(", ")}`,
    );
  }

  const storedSanitization = options.sanitizationConfig
    ? null
    : await getEmailSanitizationConfiguration({
        db: db.databaseName,
        authorizationScope: options.authorizationScope,
        workspaceId: options.workspaceId,
      });
  const parsedIssue = await parseEmlBuffer(content, {
    sourceFile,
    type,
    defaultType,
    issueTypeItems: optionLists.types?.items,
    sanitizationConfig:
      options.sanitizationConfig || storedSanitization?.config,
  });
  if (!type && !issueTypes.includes(parsedIssue.type)) {
    parsedIssue.type = defaultType;
  }
  parsedIssue.status = defaultStatus;
  parsedIssue.dates.closedAt = defaultStatus === "closed" ? new Date() : null;
  if (title) parsedIssue.title = title;
  const plan = await planImport(
    db,
    parsedIssue,
    explicitId,
    defaultStatus,
    {
      ...(options.workspaceId !== undefined
        ? { workspaceId: options.workspaceId }
        : {}),
      ...(options.applicationId !== undefined
        ? { applicationId: options.applicationId }
        : {}),
      ...(options.affectedComponentIds !== undefined
        ? { affectedComponentIds: options.affectedComponentIds }
        : {}),
    },
    options.authorizationScope,
  );
  const classificationProvided = options.classification !== undefined;
  if (classificationProvided) {
    const classification = normalizeClassificationPayload(
      options.classification,
    );
    await assertTaxonomyIdsApplicable(
      db,
      [
        classification.primaryTaxonomyId,
        ...classification.secondaryTaxonomyIds,
      ],
      plan.issue.workspaceId,
      plan.issue.applicationId,
    );
    plan.issue.classification = {
      ...classification,
      updatedAt: new Date(),
      updatedBy: options.actor || "biaws-api",
    };
  } else if (plan.existingIssue?.classification) {
    plan.issue.classification = plan.existingIssue.classification;
  }
  return {
    db,
    parsedIssue,
    plan,
    defaultStatus,
    classificationProvided,
  };
}

async function storeAttachments(options, parsedIssue, plan) {
  ensureIssueDirectory(options, plan.issueId, plan.issue);
  const attachmentStorage = createAttachmentStorage(options);
  await attachmentStorage.initialize();
  const contentByIndex = new Map(
    (parsedIssue.attachmentContents || []).map((attachment) => [
      attachment.index,
      attachment,
    ]),
  );
  const { merged: attachments, byKey: attachmentIndexes } =
    mergeExistingAttachments(plan.existingIssue?.attachments || []);
  let nextAttachmentIndex =
    attachments.reduce(
      (maximum, attachment) =>
        Number.isInteger(attachment.index)
          ? Math.max(maximum, attachment.index)
          : maximum,
      -1,
    ) + 1;
  const newlyStoredAttachments = [];

  for (const parsedAttachment of parsedIssue.attachments || []) {
    const dedupeKey = attachmentDedupeKey(parsedAttachment);
    const existingIndex = attachmentIndexes.get(dedupeKey);
    if (existingIndex !== undefined) {
      attachments[existingIndex] = {
        ...attachments[existingIndex],
        tags: mergeTags(attachments[existingIndex].tags, parsedAttachment.tags),
      };
      continue;
    }

    const attachment = {
      ...parsedAttachment,
      index: nextAttachmentIndex,
      uploadedAt: new Date(),
    };
    const content = contentByIndex.get(parsedAttachment.index)?.content;
    const key = buildAttachmentStorageKey(plan.issueId, attachment, plan.issue);
    const storage = await attachmentStorage.save({ key, content });
    const storedAttachment = {
      ...attachment,
      storage: { ...storage, relativePath: storage.key },
    };
    attachmentIndexes.set(dedupeKey, attachments.length);
    attachments.push(storedAttachment);
    newlyStoredAttachments.push(storedAttachment);
    nextAttachmentIndex += 1;
  }
  return {
    issue: { ...plan.issue, attachments },
    newlyStoredAttachments,
  };
}

async function persistImportedIssue(
  db,
  plan,
  issue,
  defaultStatus,
  classificationProvided,
  options,
) {
  if (!plan.existingIssue) {
    await db.collection(ISSUES_COLLECTION).insertOne({
      ...issue,
      createdBy: options.actor || "biaws-api",
      updatedBy: options.actor || "biaws-api",
    });
    return;
  }

  const contextFields = issue.workspaceId
    ? {
        workspaceId: issue.workspaceId,
        applicationId: issue.applicationId,
        affectedComponentIds: issue.affectedComponentIds,
      }
    : {};
  await db.collection(ISSUES_COLLECTION).updateOne(
    { id: plan.issueId },
    {
      $set: {
        type: issue.type,
        ...contextFields,
        ...(classificationProvided
          ? { classification: issue.classification }
          : {}),
        title: issue.title,
        text: issue.text,
        "dates.receivedEmailAt": issue.dates.receivedEmailAt,
        "dates.firstThreadEmailAt": issue.dates.firstThreadEmailAt,
        "dates.closedAt": defaultStatus === "closed" ? new Date() : null,
        source: issue.source,
        attachments: issue.attachments,
        status: defaultStatus,
        updatedAt: issue.updatedAt,
        updatedBy: options.actor || "biaws-api",
      },
    },
  );
}

async function importComments(db, parsedIssue, issueId) {
  let insertedComments = 0;
  let skippedComments = 0;
  for (const message of parsedIssue.messages) {
    const result = await db
      .collection(COMMENTS_COLLECTION)
      .updateOne(
        { issueId, hash: message.hash },
        { $setOnInsert: buildCommentDocument(parsedIssue, issueId, message) },
        { upsert: true },
      );
    if (result.upsertedCount) insertedComments += 1;
    else skippedComments += 1;
  }
  return { insertedComments, skippedComments };
}

export async function importEmlBuffer(content, options = {}) {
  const { db, parsedIssue, plan, defaultStatus, classificationProvided } =
    await prepareImport(content, options);
  const action = plan.existingIssue ? "update" : "create";
  const reopenedIssue = Boolean(
    plan.existingIssue && plan.existingIssue.status !== defaultStatus,
  );

  if (options.dryRun) {
    return {
      mode: "dry-run",
      action,
      reopenedIssue,
      issue: plan.issue,
      comments: plan.comments,
      attachments: plan.issue.attachments,
    };
  }

  const { issue, newlyStoredAttachments } = await storeAttachments(
    options,
    parsedIssue,
    plan,
  );
  await persistImportedIssue(
    db,
    plan,
    issue,
    defaultStatus,
    classificationProvided,
    options,
  );
  const { insertedComments, skippedComments } = await importComments(
    db,
    parsedIssue,
    plan.issueId,
  );

  const [storedIssue, comments] = await Promise.all([
    db.collection(ISSUES_COLLECTION).findOne({ id: plan.issueId }),
    db
      .collection(COMMENTS_COLLECTION)
      .find({ issueId: plan.issueId })
      .sort({ index: 1, createdAt: 1, _id: 1 })
      .toArray(),
  ]);
  const mirror = writeIssueMirror(options, plan.issueId, storedIssue, comments);

  return {
    mode: "import",
    action,
    issueId: plan.issueId,
    createdIssue: !plan.existingIssue,
    reopenedIssue,
    insertedComments,
    skippedComments,
    storedAttachments: newlyStoredAttachments.filter(
      (attachment) => attachment.storage?.saved,
    ).length,
    issueDir: mirror.issueDir,
    issue: storedIssue,
  };
}
