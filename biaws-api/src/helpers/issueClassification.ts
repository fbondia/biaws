import { textValue } from "./text.js";
function createHttpError(statusCode: number | undefined, message: string | undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeStringArray(value: unknown, fieldName: string) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw createHttpError(422, `Invalid classification payload: ${fieldName} must be an array`);
  }

  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

export function normalizeClassificationPayload(payload: Record<string, unknown> = {}) {
  const primaryTaxonomyId = textValue(payload.primaryTaxonomyId || "").trim();
  const summary = textValue(payload.summary || "").trim();
  const secondaryTaxonomyIds = normalizeStringArray(payload.secondaryTaxonomyIds, "secondaryTaxonomyIds").filter(
    (taxonomyId) => taxonomyId !== primaryTaxonomyId,
  );
  const tags: Record<string, string[]> = {};

  if (payload.tags !== undefined && (payload.tags === null || typeof payload.tags !== "object")) {
    throw createHttpError(422, "Invalid classification payload: tags must be an object");
  }

  for (const [groupId, tagIds] of Object.entries(payload.tags ?? {})) {
    const normalizedGroupId = String(groupId || "").trim();
    if (!normalizedGroupId) continue;
    tags[normalizedGroupId] = normalizeStringArray(tagIds, `tags.${normalizedGroupId}`);
  }

  return {
    primaryTaxonomyId,
    secondaryTaxonomyIds,
    summary,
    tags,
  };
}
