export function contextFromPreviewIssue(issue, fallbackContext) {
  return {
    applicationId: issue?.applicationId || fallbackContext.applicationId,
    affectedComponentIds: Array.isArray(issue?.affectedComponentIds)
      ? [...issue.affectedComponentIds]
      : [...fallbackContext.affectedComponentIds],
  };
}

export function shouldRetryContextDiscovery(
  error,
  discoverContext,
  fallbackContext,
) {
  return Boolean(
    discoverContext &&
    error?.code === "APPLICATION_REQUIRED" &&
    fallbackContext?.applicationId,
  );
}

export function cloneEmlClassification(classification = {}) {
  return {
    primaryTaxonomyId: classification.primaryTaxonomyId || "",
    secondaryTaxonomyIds: [...(classification.secondaryTaxonomyIds || [])],
    summary: classification.summary || "",
    tags: Object.fromEntries(
      Object.entries(classification.tags || {}).map(([groupId, tagIds]) => [
        groupId,
        [...tagIds],
      ]),
    ),
  };
}

export function mergeEmlClassificationSection(current, draft, section) {
  const base = cloneEmlClassification(current);
  const next = cloneEmlClassification(draft);

  if (section === "tags") {
    return { ...base, tags: next.tags };
  }

  return {
    ...base,
    primaryTaxonomyId: next.primaryTaxonomyId,
    secondaryTaxonomyIds: next.secondaryTaxonomyIds,
  };
}

export function selectedEmlTaxonomyIds(classification) {
  return [
    classification.primaryTaxonomyId,
    ...classification.secondaryTaxonomyIds,
  ].filter(Boolean);
}
