export function todayIso(clock = () => new Date()) {
  return clock().toISOString().slice(0, 10);
}

export function createEmptyDocumentDraft(
  documentTypes,
  documentType,
  collectionId = "",
  clock,
) {
  const config = documentTypes[documentType];
  return {
    id: "",
    documentType,
    title: "",
    summary: "",
    markdown: config.template,
    applicationId: "",
    affectedComponentIds: [],
    collectionId,
    status: config.defaultStatus,
    details: { ...config.details },
    source: { mode: "native", repositoryId: "", path: "" },
    references: [],
    definedAt: todayIso(clock),
    lastReviewedAt: "",
    nextReviewAt: "",
  };
}

export function normalizeDocumentDraft(documentTypes, record = {}) {
  const documentType = record.documentType || "business-rule";
  return {
    ...createEmptyDocumentDraft(documentTypes, documentType),
    ...record,
    details: {
      ...documentTypes[documentType].details,
      ...(record.details || {}),
    },
    source: {
      mode: "native",
      repositoryId: "",
      path: "",
      ...(record.source || {}),
    },
    affectedComponentIds: record.affectedComponentIds || [],
    references: record.references || [],
  };
}

export function documentStatusLabel(documentTypes, document) {
  return (
    documentTypes[document.documentType]?.statuses.find(
      ([value]) => value === document.status,
    )?.[1] || document.status
  );
}
