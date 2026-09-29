interface IssueOptions {
  types: string[];
  statuses: string[];
  defaultType: string;
  defaultStatus: string;
}
import type { Document, WithId } from "mongodb";
import type {
  IssueDocument,
  PublicIssueDocument,
  IssueCommentDocument,
  PublicIssueCommentDocument,
} from "../../types/issues.js";
import { normalizeIssueIdentifier, parseIssueDate } from "./identifiers.js";
import { createHttpError } from "./support.js";
import { knowledgeContextWasProvided } from "../shared/knowledgeContext.js";

function normalizeDocumentValue(document: WithId<Document> | null) {
  if (!document) return null;

  const { jiraCreatedAt, jiraUpdatedAt, jiraResolutionDate, ...dates } =
    document.dates || {};
  const { jira, ...source } = document.source || {};

  return {
    ...document,
    _id: document._id?.toString?.() ?? document._id,
    ...(document.dates ? { dates } : {}),
    ...(document.source ? { source } : {}),
  };
}

export function normalizeIssuePatchPayload(
  payload: Record<string, unknown> = {},
  issueOptions: IssueOptions,
) {
  const $set: Record<string, string | Date | null> = {};
  if (Object.hasOwn(payload, "identifier"))
    $set.identifier = normalizeIssueIdentifier(payload.identifier);

  for (const field of ["title", "text"]) {
    if (!Object.hasOwn(payload, field)) continue;
    const value = String(payload[field] || "").trim();
    if (!value) {
      throw createHttpError(422, `Invalid issue payload: ${field} is required`);
    }
    $set[field] = value;
  }

  if (Object.hasOwn(payload, "type")) {
    const type = String(payload.type || "").trim();
    if (!issueOptions.types.includes(type)) {
      throw createHttpError(
        422,
        `Invalid issue payload: type must be one of ${issueOptions.types.join(", ")}`,
      );
    }
    $set.type = type;
  }

  if (Object.hasOwn(payload, "status")) {
    const status = String(payload.status || "").trim();
    if (!issueOptions.statuses.includes(status)) {
      throw createHttpError(
        422,
        `Invalid issue payload: status must be one of ${issueOptions.statuses.join(", ")}`,
      );
    }
    $set.status = status;
  }

  if (!Object.keys($set).length && !knowledgeContextWasProvided(payload)) {
    throw createHttpError(
      422,
      "Invalid issue payload: title, text, type, status or application context is required",
    );
  }

  return $set;
}

export function normalizeIssueCreatePayload(
  payload: Record<string, unknown> = {},
  issueOptions: IssueOptions,
) {
  const title = String(payload.title || "").trim();
  const text = String(payload.text || "").trim();
  const type = String(payload.type || issueOptions.defaultType).trim();
  const status = String(payload.status || issueOptions.defaultStatus).trim();

  if (!title)
    throw createHttpError(422, "Invalid issue payload: title is required");
  if (!text)
    throw createHttpError(422, "Invalid issue payload: text is required");
  if (!issueOptions.types.includes(type)) {
    throw createHttpError(
      422,
      `Invalid issue payload: type must be one of ${issueOptions.types.join(", ")}`,
    );
  }
  if (!issueOptions.statuses.includes(status)) {
    throw createHttpError(
      422,
      `Invalid issue payload: status must be one of ${issueOptions.statuses.join(", ")}`,
    );
  }

  return {
    id: String(payload.id || "").trim(),
    identifier: normalizeIssueIdentifier(payload.identifier),
    type,
    status,
    title,
    text,
    date: parseIssueDate(payload.date),
    comment: String(payload.comment || "").trim(),
    source:
      payload.source &&
      typeof payload.source === "object" &&
      !Array.isArray(payload.source)
        ? payload.source
        : {},
  };
}

export function normalizeDocument(
  document: WithId<IssueDocument>,
): PublicIssueDocument;
export function normalizeDocument(
  document: WithId<IssueDocument> | null,
): PublicIssueDocument | null;
export function normalizeDocument(
  document: WithId<IssueCommentDocument>,
): PublicIssueCommentDocument;
export function normalizeDocument(
  document: WithId<IssueCommentDocument> | null,
): PublicIssueCommentDocument | null;
export function normalizeDocument(
  document: NonNullable<Parameters<typeof normalizeDocumentValue>[0]>,
): NonNullable<ReturnType<typeof normalizeDocumentValue>>;
export function normalizeDocument(
  document: Parameters<typeof normalizeDocumentValue>[0],
): ReturnType<typeof normalizeDocumentValue>;
export function normalizeDocument(
  document: Parameters<typeof normalizeDocumentValue>[0],
) {
  return normalizeDocumentValue(document);
}
