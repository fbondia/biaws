import { cleanParams, fetchJson, sendJson } from "../../httpClient.js";

const BASE_PATH = "/api/knowledge/documents";

function documentPayload(args = {}, current = {}) {
  return {
    documentType: args.documentType ?? current.documentType,
    title: args.title ?? current.title,
    summary: args.summary ?? current.summary,
    markdown: args.markdown ?? current.markdown,
    applicationId: args.applicationId ?? current.applicationId,
    affectedComponentIds:
      args.affectedComponentIds ?? current.affectedComponentIds ?? [],
    collectionId: args.collectionId ?? current.collectionId ?? "",
    status: args.status ?? current.status,
    details: args.details ?? current.details ?? {},
    source: args.source ?? current.source ?? { mode: "native" },
    references: args.references ?? current.references ?? [],
    definedAt: args.definedAt ?? current.definedAt,
    lastReviewedAt: args.lastReviewedAt ?? current.lastReviewedAt ?? "",
    nextReviewAt: args.nextReviewAt ?? current.nextReviewAt ?? "",
    changeSummary: args.changeSummary,
  };
}

export async function searchDocuments(args = {}) {
  return fetchJson(
    BASE_PATH,
    cleanParams({
      search: args.search ?? args.q,
      documentType: args.documentType,
      applicationId: args.applicationId,
      componentId: args.componentId,
      collectionId: args.collectionId,
      status: args.status,
      currentOnly: args.currentOnly,
      includeWorkspace: args.includeWorkspace,
      includeArchived: args.includeArchived,
      page: args.page,
      limit: args.limit,
    }),
  );
}

export async function getDocument(args = {}) {
  const documentId = String(args.documentId || "").trim();
  if (!documentId) throw new Error("documentId is required");
  return fetchJson(`${BASE_PATH}/${encodeURIComponent(documentId)}`);
}

export async function createDocument(args = {}) {
  for (const field of ["documentType", "title", "summary", "markdown"]) {
    if (!String(args[field] || "").trim())
      throw new Error(`${field} is required`);
  }
  return sendJson(BASE_PATH, documentPayload(args), {}, "POST");
}

export async function updateDocument(args = {}) {
  const documentId = String(args.documentId || "").trim();
  if (!documentId) throw new Error("documentId is required");
  const currentPayload = await getDocument({ documentId });
  return sendJson(
    `${BASE_PATH}/${encodeURIComponent(documentId)}`,
    documentPayload(args, currentPayload.document),
    {},
    "PUT",
  );
}

export async function addDocumentObservation(args = {}) {
  const documentId = String(args.documentId || "").trim();
  const markdown = String(args.markdown || "").trim();
  if (!documentId) throw new Error("documentId is required");
  if (!markdown) throw new Error("markdown is required");
  return sendJson(
    `${BASE_PATH}/${encodeURIComponent(documentId)}/observations`,
    { markdown },
    {},
    "POST",
  );
}

export async function loadKnowledgeContext(args = {}) {
  const applicationId = String(args.applicationId || "").trim();
  if (!applicationId) throw new Error("applicationId is required");
  const list = await searchDocuments({
    applicationId,
    componentId: args.componentId,
    includeWorkspace: true,
    currentOnly: true,
    limit: args.limit || 50,
  });
  const items = list.items || [];
  const documents =
    args.includeMarkdown === false
      ? items
      : await Promise.all(
          items.map(
            async ({ id }) => (await getDocument({ documentId: id })).document,
          ),
        );
  return {
    applicationId,
    componentId: args.componentId || null,
    documents,
  };
}
