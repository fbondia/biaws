import type { ApiEntity } from "../../apiContracts.js";
import type { ServiceArguments } from "../../contracts.js";
import { BiawsError } from "../../errors.js";
import { cleanParams, fetchJson, sendJson } from "../../httpClient.js";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypeCatalog.js";

const BASE_PATH = "/api/knowledge/documents";

function documentPayload(
  args: Record<string, unknown> = {},
  current: ApiEntity = {},
) {
  return {
    identifier: args.identifier ?? current.identifier,
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
    classification: args.classification ??
      current.classification ?? {
        primaryTaxonomyId: "",
        secondaryTaxonomyIds: [],
        tags: {},
      },
    source: args.source ?? current.source ?? { mode: "native" },
    references: args.references ?? current.references ?? [],
    definedAt: args.definedAt ?? current.definedAt,
    lastReviewedAt: args.lastReviewedAt ?? current.lastReviewedAt ?? "",
    nextReviewAt: args.nextReviewAt ?? current.nextReviewAt ?? "",
    changeSummary: args.changeSummary,
  };
}

export function listDocumentTypes() {
  return {
    documentTypes: Object.values(DOCUMENT_TYPE_CATALOG).map((config) => ({
      ...config,
      context: config.applicationRequired
        ? { applicationId: "required", affectedComponentIds: "optional" }
        : config.type === "guideline"
          ? {
              applicationId: "depends-on-details.scope",
              affectedComponentIds: "required-when-scope-is-component",
            }
          : { applicationId: "optional", affectedComponentIds: "optional" },
    })),
    commonRules: {
      workspaceId: "implicit-from-mcp-configuration",
      affectedComponentIds: "requires-applicationId",
      documentType: "immutable-after-creation",
      repositorySource: "repositoryId-and-path-required",
    },
  };
}

export async function searchDocuments(
  args: ServiceArguments<"documents_search"> = {},
) {
  return fetchJson(
    BASE_PATH,
    cleanParams({
      search: args.search,
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

export async function getDocument(args: { documentId?: string } = {}) {
  const documentId = String(args.documentId || "").trim();
  if (!documentId) throw new BiawsError("documentId is required");
  return fetchJson(`${BASE_PATH}/${encodeURIComponent(documentId)}`);
}

export async function createDocument(
  args: ServiceArguments<"documents_create"> = {},
) {
  for (const field of [
    "documentType",
    "title",
    "summary",
    "markdown",
  ] as const) {
    if (!String(args[field] || "").trim())
      throw new BiawsError(`${field} is required`);
  }
  return sendJson(BASE_PATH, documentPayload(args), {}, "POST");
}

export async function updateDocument(
  args: ServiceArguments<"documents_update"> = {},
) {
  const documentId = String(args.documentId || "").trim();
  if (!documentId) throw new BiawsError("documentId is required");
  const currentPayload = await getDocument({ documentId });
  return sendJson(
    `${BASE_PATH}/${encodeURIComponent(documentId)}`,
    documentPayload(args, currentPayload.document),
    {},
    "PUT",
  );
}

export async function addDocumentObservation(
  args: ServiceArguments<"documents_add_observation"> = {},
) {
  const documentId = String(args.documentId || "").trim();
  const markdown = String(args.markdown || "").trim();
  if (!documentId) throw new BiawsError("documentId is required");
  if (!markdown) throw new BiawsError("markdown is required");
  return sendJson(
    `${BASE_PATH}/${encodeURIComponent(documentId)}/observations`,
    { markdown },
    {},
    "POST",
  );
}

export async function loadKnowledgeContext(
  args: ServiceArguments<"knowledge_context_load"> = {},
) {
  const applicationId = String(args.applicationId || "").trim();
  if (!applicationId) throw new BiawsError("applicationId is required");
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
