function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeStringArray(value, fieldName) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw createHttpError(
      422,
      `Invalid classification payload: ${fieldName} must be an array`,
    );
  }

  return [
    ...new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  ];
}

export function normalizeClassificationPayload(payload = {}) {
  const primaryTaxonomyId = String(payload.primaryTaxonomyId || "").trim();
  const summary = String(payload.summary || "").trim();
  const secondaryTaxonomyIds = normalizeStringArray(
    payload.secondaryTaxonomyIds,
    "secondaryTaxonomyIds",
  ).filter((taxonomyId) => taxonomyId !== primaryTaxonomyId);
  const tags = {};

  if (
    payload.tags !== undefined &&
    (payload.tags === null || typeof payload.tags !== "object")
  ) {
    throw createHttpError(
      422,
      "Invalid classification payload: tags must be an object",
    );
  }

  for (const [groupId, tagIds] of Object.entries(payload.tags || {})) {
    const normalizedGroupId = String(groupId || "").trim();
    if (!normalizedGroupId) continue;
    tags[normalizedGroupId] = normalizeStringArray(
      tagIds,
      `tags.${normalizedGroupId}`,
    );
  }

  return {
    primaryTaxonomyId,
    secondaryTaxonomyIds,
    summary,
    tags,
  };
}
