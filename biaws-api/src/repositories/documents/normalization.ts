import { Document } from "mongodb";
import { isRecord } from "../../helpers/records.js";
import { normalizeResourceIdentifier } from "../../helpers/resourceIdentifier.js";
import { textValue } from "../../helpers/text.js";
import type {
  KnowledgeDocument,
  PublicStoredKnowledgeDocument,
  StoredKnowledgeDocument,
} from "../../types/documents.js";
import { MAX_SUMMARY, MAX_TITLE } from "./constants.js";
import { normalizeReferences } from "./references.js";
import { enumValue, httpError, normalizeDate, shortText, today } from "./support.js";
import { documentTypeConfig } from "./types.js";

function normalizeStringArray(value: unknown, field: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw httpError(422, "INVALID_DOCUMENT_CLASSIFICATION", `${field} deve ser um array`);
  }
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeClassification(value: unknown, current: Record<string, unknown> = {}) {
  const classification = value === undefined ? current || {} : value;
  if (!isRecord(classification)) {
    throw httpError(422, "INVALID_DOCUMENT_CLASSIFICATION", "classification deve ser um objeto");
  }
  const primaryTaxonomyId = textValue(classification.primaryTaxonomyId || "").trim();
  const secondaryTaxonomyIds = normalizeStringArray(
    classification.secondaryTaxonomyIds,
    "classification.secondaryTaxonomyIds",
  ).filter((id) => id !== primaryTaxonomyId);
  if (classification.tags !== undefined && (!classification.tags || !isRecord(classification.tags))) {
    throw httpError(422, "INVALID_DOCUMENT_CLASSIFICATION", "classification.tags deve ser um objeto");
  }
  const tags = Object.fromEntries(
    Object.entries(classification.tags || {}).flatMap(([groupId, tagIds]) => {
      const normalizedGroupId = String(groupId || "").trim();
      return normalizedGroupId
        ? [[normalizedGroupId, normalizeStringArray(tagIds, `classification.tags.${normalizedGroupId}`)]]
        : [];
    }),
  );
  return { primaryTaxonomyId, secondaryTaxonomyIds, tags };
}

export function documentReplicationPayload(document: KnowledgeDocument = {}) {
  return {
    identifier: document.identifier,
    title: document.title,
    summary: document.summary,
    markdown: document.markdown,
  };
}

export function normalizeStoredDocument(document: StoredKnowledgeDocument): PublicStoredKnowledgeDocument;
export function normalizeStoredDocument(document: StoredKnowledgeDocument | null): PublicStoredKnowledgeDocument | null;
export function normalizeStoredDocument<T extends Document>(document: T): Omit<T, "_id"> & { _id: string | undefined };
export function normalizeStoredDocument<T extends Document>(
  document: T | null,
): (Omit<T, "_id"> & { _id: string | undefined }) | null;
export function normalizeStoredDocument<T extends Document>(document: T | null) {
  if (!document) return null;
  return { ...document, _id: document._id?.toString() };
}

function normalizeDetails(type: string, value: unknown = {}, current: Record<string, unknown> = {}) {
  if (value !== undefined && !isRecord(value)) {
    throw httpError(422, "INVALID_DOCUMENT_DETAILS", "details deve ser um objeto");
  }
  const details: Record<string, unknown> = isRecord(value) ? value : {};
  const previous = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  if (type === "business-rule") {
    return {
      ruleCode: shortText(details.ruleCode ?? previous.ruleCode, "details.ruleCode", 80),
      effectiveFrom: normalizeDate(details.effectiveFrom ?? previous.effectiveFrom, "details.effectiveFrom"),
    };
  }
  if (type === "architecture-decision") {
    return {
      decidedAt: normalizeDate(details.decidedAt ?? previous.decidedAt, "details.decidedAt"),
    };
  }
  if (type === "guideline") {
    return {
      scope: enumValue(
        details.scope ?? previous.scope,
        "details.scope",
        ["workspace", "application", "component"],
        "workspace",
      ),
      enforcement: enumValue(
        details.enforcement ?? previous.enforcement,
        "details.enforcement",
        ["required", "recommended", "informative"],
        "recommended",
      ),
    };
  }
  if (type === "feature") {
    return {
      maturity: enumValue(
        details.maturity ?? previous.maturity,
        "details.maturity",
        ["planned", "beta", "stable", "retired"],
        "stable",
      ),
    };
  }
  if (type === "procedure") return {};
  return {
    referenceKind: enumValue(
      details.referenceKind ?? previous.referenceKind,
      "details.referenceKind",
      ["architecture", "contract", "schema", "protocol", "mechanism"],
      "architecture",
    ),
  };
}

function normalizeSource(value: unknown = {}, current: Record<string, unknown> = {}) {
  const source: Record<string, unknown> = isRecord(value) ? value : {};
  const previous = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  const mode = enumValue(source.mode ?? previous.mode, "source.mode", ["native", "repository"], "native");
  const repositoryId = shortText(source.repositoryId ?? previous.repositoryId, "source.repositoryId", 160);
  const path = shortText(source.path ?? previous.path, "source.path", 500);
  if (mode === "repository" && (!repositoryId || !path)) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_SOURCE",
      "source.repositoryId e source.path são obrigatórios para conteúdo de repositório",
    );
  }
  return {
    mode,
    repositoryId: mode === "repository" ? repositoryId : "",
    path: mode === "repository" ? path : "",
  };
}

function summaryFrom(markdown: string) {
  return String(markdown || "")
    .replaceAll(/```[\s\S]*?```/gu, " ")
    .replaceAll(/[#>*_`[\]()~-]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 280);
}

export function normalizeDocumentPayload(
  payload: Record<string, unknown> = {},
  current: KnowledgeDocument | null = null,
) {
  const documentType = textValue(payload.documentType ?? current?.documentType ?? "").trim();
  const config = documentTypeConfig(documentType);
  if (current && documentType !== current.documentType) {
    throw httpError(422, "DOCUMENT_TYPE_IMMUTABLE", "documentType não pode ser alterado após a criação");
  }
  const title = textValue(payload.title ?? current?.title ?? "").trim();
  const markdown = textValue(payload.markdown ?? current?.markdown ?? "").trim();
  const summary = textValue(payload.summary ?? current?.summary ?? summaryFrom(markdown)).trim();
  const status = textValue(payload.status ?? current?.status ?? config.defaultStatus).trim();
  if (!title || title.length > MAX_TITLE) {
    throw httpError(422, "INVALID_DOCUMENT", `title é obrigatório e deve ter até ${MAX_TITLE} caracteres`);
  }
  if (!summary || summary.length > MAX_SUMMARY) {
    throw httpError(422, "INVALID_DOCUMENT", `summary é obrigatório e deve ter até ${MAX_SUMMARY} caracteres`);
  }
  if (!markdown) throw httpError(422, "INVALID_DOCUMENT", "markdown é obrigatório");
  if (!config.statuses.includes(status)) {
    throw httpError(422, "INVALID_DOCUMENT_STATUS", `status inválido para ${documentType}: ${status}`);
  }
  const lastReviewedAt = normalizeDate(payload.lastReviewedAt ?? current?.lastReviewedAt, "lastReviewedAt");
  const reviewChanged = lastReviewedAt && lastReviewedAt !== String(current?.lastReviewedAt || "");
  return {
    identifier: normalizeResourceIdentifier(payload.identifier, current?.identifier),
    documentType,
    schemaVersion: 1,
    title,
    summary,
    markdown,
    status,
    details: normalizeDetails(documentType, payload.details, current?.details),
    classification: normalizeClassification(payload.classification, current?.classification),
    source: normalizeSource(payload.source, current?.source),
    collectionId: textValue(payload.collectionId ?? current?.collectionId ?? "").trim(),
    references: normalizeReferences(payload.references, current?.references),
    definedAt: normalizeDate(payload.definedAt ?? current?.definedAt ?? today(), "definedAt", { required: true }),
    lastReviewedAt,
    nextReviewAt: normalizeDate(payload.nextReviewAt ?? current?.nextReviewAt, "nextReviewAt"),
    reviewedBy: textValue(
      payload.reviewedBy ??
        (reviewChanged ? payload.updatedBy || payload.createdBy : null) ??
        current?.reviewedBy ??
        "",
    ).trim(),
  };
}

export function restoredDocumentStatus(document: KnowledgeDocument) {
  const config = documentTypeConfig(document.documentType || "");
  return document.archivedFromStatus &&
    document.archivedFromStatus !== "archived" &&
    config.statuses.includes(document.archivedFromStatus)
    ? document.archivedFromStatus
    : config.defaultStatus;
}
