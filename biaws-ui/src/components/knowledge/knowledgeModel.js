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

export async function fetchAllDocumentPages(fetchPage, params = {}) {
  const firstPage = await fetchPage({ ...params, limit: 100, page: 1 });
  const items = [...(firstPage.items || [])];
  const totalPages = firstPage.meta?.totalPages || 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchPage({ ...params, limit: 100, page });
    items.push(...(payload.items || []));
  }

  return {
    ...firstPage,
    items,
    meta: {
      ...(firstPage.meta || {}),
      page: 1,
      total: firstPage.meta?.total ?? items.length,
      totalPages,
    },
  };
}
