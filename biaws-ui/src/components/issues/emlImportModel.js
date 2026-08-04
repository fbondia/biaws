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
