import { scalarText } from "../../runtime/text.js";
import type { ApiEntity, ApiPayload } from "../../api/apiContracts.js";
import type { ServiceArguments } from "../../mcp/tools/contracts.js";
import { BiawsError } from "../../runtime/errors.js";
import { cleanParams, deleteJson, fetchJson, sendJson, sendMultipart } from "../../api/httpClient.js";
import { assertExpectedEmlHash, readLocalEml } from "./emlFile.js";
interface FlatTaxonomy {
  id?: string;
  label?: string;
  path: string[];
  searchText: string;
}

function flattenTaxonomy(nodes: ApiEntity[] = [], parentPath: string[] = []): FlatTaxonomy[] {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.label || node.id || ""];
    return [
      {
        id: node.id,
        label: node.label,
        path,
        searchText: [node.id, node.label, ...path].join(" ").toLowerCase(),
      },
      ...flattenTaxonomy(node.children || [], path),
    ];
  });
}

function findTaxonomyNode(nodes: ApiEntity[], taxonomyId: string): ApiEntity | null {
  for (const node of nodes) {
    if (node.id === taxonomyId) return node;
    const child = findTaxonomyNode(node.children || [], taxonomyId);
    if (child) return child;
  }
  return null;
}

function appendTaxonomyNode(nodes: ApiEntity[], parentId: string, item: ApiEntity): ApiEntity[] {
  if (!parentId) return [...nodes, item];

  return nodes.map((node) =>
    node.id === parentId
      ? { ...node, children: [...(node.children || []), item] }
      : {
          ...node,
          ...(node.children
            ? {
                children: appendTaxonomyNode(node.children, parentId, item),
              }
            : {}),
        },
  );
}

function updateTaxonomyNode(nodes: ApiEntity[], taxonomyId: string, patch: Partial<ApiEntity>): ApiEntity[] {
  return nodes.map((node) =>
    node.id === taxonomyId
      ? { ...node, ...patch }
      : {
          ...node,
          ...(node.children
            ? {
                children: updateTaxonomyNode(node.children, taxonomyId, patch),
              }
            : {}),
        },
  );
}

function normalizeApplicationIds(value: string[] | undefined) {
  return [...new Set((value || []).map((applicationId) => String(applicationId || "").trim()).filter(Boolean))];
}

function writableTaxonomyPackage(taxonomy: NonNullable<ApiPayload["taxonomy"]>) {
  return {
    schemaVersion: taxonomy.schemaVersion || 1,
    source: taxonomy.source || null,
    tagGroups: taxonomy.tagGroups || [],
    taxonomy: taxonomy.taxonomy || [],
    updatedBy: "biaws-mcp",
  };
}

async function loadWritableTaxonomy(workspaceId: string | undefined) {
  const payload = await fetchJson("/api/issues/taxonomy", cleanParams({ workspaceId }));
  if (!payload.taxonomy) throw new BiawsError("Issue taxonomy not found");
  return writableTaxonomyPackage(payload.taxonomy);
}

async function saveWritableTaxonomy(taxonomy: unknown, workspaceId: string | undefined) {
  return sendJson("/api/issues/taxonomy", taxonomy, cleanParams({ workspaceId }));
}

function tokenize(value: unknown) {
  return scalarText(value || "")
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3);
}

function scoreTaxonomyNode(node: FlatTaxonomy, tokens: string[], rawText: string) {
  const normalizedNodeText = node.searchText.normalize("NFKD").replaceAll(/\p{Diacritic}/gu, "");
  let score = 0;

  for (const token of tokens) {
    if (normalizedNodeText.includes(token)) score += 3;
    if (rawText.includes(token)) score += 1;
  }

  return score;
}

export async function searchIssues(args: ServiceArguments<"issues_search"> = {}) {
  return fetchJson("/api/issues", cleanParams(args));
}

export async function getIssueDetails(args: ServiceArguments<"issues_get"> = {}) {
  if (!args.issueId) throw new BiawsError("issueId is required");
  return fetchJson(`/api/issues/${encodeURIComponent(args.issueId)}`);
}

export async function addIssueComment(args: ServiceArguments<"issues_add_comment"> = {}) {
  const issueId = String(args.issueId || "").trim();
  const text = String(args.text || "").trim();
  if (!issueId) throw new BiawsError("issueId is required");
  if (!text) throw new BiawsError("text is required");

  return sendJson(
    `/api/issues/${encodeURIComponent(issueId)}/comments`,
    { text, ...(args.date !== undefined ? { date: args.date } : {}) },
    {},
    "POST",
  );
}

export async function updateIssueComment(args: ServiceArguments<"issues_update_comment"> = {}) {
  const issueId = String(args.issueId || "").trim();
  const commentId = String(args.commentId || "").trim();
  const text = String(args.text || "").trim();
  if (!issueId) throw new BiawsError("issueId is required");
  if (!commentId) throw new BiawsError("commentId is required");
  if (!text) throw new BiawsError("text is required");

  return sendJson(`/api/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`, {
    text,
    ...(args.date !== undefined ? { date: args.date } : {}),
  });
}

export async function deleteIssueComment(args: ServiceArguments<"issues_delete_comment"> = {}) {
  const issueId = String(args.issueId || "").trim();
  const commentId = String(args.commentId || "").trim();
  if (!issueId) throw new BiawsError("issueId is required");
  if (!commentId) throw new BiawsError("commentId is required");

  return deleteJson(`/api/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`);
}

export async function getIssueClassificationCatalog(args: ServiceArguments<"issues_get_classification_catalog"> = {}) {
  const payload = await fetchJson("/api/issues/taxonomy", cleanParams({ applicationId: args.applicationId }));
  const catalog = payload.taxonomy || {};
  const result: {
    meta?: ApiPayload["meta"];
    schemaVersion?: number;
    source?: unknown;
    taxonomy: ApiEntity[];
    tagGroups: NonNullable<NonNullable<ApiPayload["taxonomy"]>["tagGroups"]>;
    taxonomyOptions?: unknown[];
    tagOptions?: unknown[];
  } = {
    meta: payload.meta,
    schemaVersion: catalog.schemaVersion,
    source: catalog.source,
    taxonomy: catalog.taxonomy || [],
    tagGroups: catalog.tagGroups || [],
  };

  if (args.flatten === true) {
    result.taxonomyOptions = flattenTaxonomy(result.taxonomy).map(({ searchText, ...node }) => ({
      ...node,
      pathLabel: node.path.join(" / "),
    }));
    result.tagOptions = result.tagGroups.flatMap((group) =>
      (group.tags || []).map((tagId) => ({
        groupId: group.id,
        groupLabel: group.label,
        tagId,
      })),
    );
  }

  return result;
}

export async function createTaxonomyItem(args: ServiceArguments<"issues_create_taxonomy_item"> = {}) {
  const id = String(args.id || "").trim();
  const label = String(args.label || "").trim();
  const parentId = String(args.parentId || "").trim();
  if (!id) throw new BiawsError("id is required");
  if (!label) throw new BiawsError("label is required");

  const taxonomy = await loadWritableTaxonomy(args.workspaceId);
  if (findTaxonomyNode(taxonomy.taxonomy, id)) {
    throw new BiawsError(`Taxonomy item already exists: ${id}`);
  }
  const parent = parentId ? findTaxonomyNode(taxonomy.taxonomy, parentId) : null;
  if (parentId && !parent) {
    throw new BiawsError(`Parent taxonomy item not found: ${parentId}`);
  }

  const item = {
    id,
    label,
    applicationIds:
      args.applicationIds === undefined
        ? normalizeApplicationIds(parent?.applicationIds)
        : normalizeApplicationIds(args.applicationIds),
  };
  taxonomy.taxonomy = appendTaxonomyNode(taxonomy.taxonomy, parentId, item);
  const result = await saveWritableTaxonomy(taxonomy, args.workspaceId);
  return {
    item: findTaxonomyNode(result.taxonomy?.taxonomy || [], id),
    parentId: parentId || null,
    taxonomy: result.taxonomy,
  };
}

export async function updateTaxonomyItem(args: ServiceArguments<"issues_update_taxonomy_item"> = {}) {
  const taxonomyId = String(args.taxonomyId || "").trim();
  if (!taxonomyId) throw new BiawsError("taxonomyId is required");
  if (args.label === undefined && args.applicationIds === undefined) {
    throw new BiawsError("label or applicationIds is required");
  }

  const taxonomy = await loadWritableTaxonomy(args.workspaceId);
  if (!findTaxonomyNode(taxonomy.taxonomy, taxonomyId)) {
    throw new BiawsError(`Taxonomy item not found: ${taxonomyId}`);
  }

  const patch: Partial<ApiEntity> = {};
  if (args.label !== undefined) {
    const label = String(args.label || "").trim();
    if (!label) throw new BiawsError("label must be a non-empty string");
    patch.label = label;
  }
  if (args.applicationIds !== undefined) {
    patch.applicationIds = normalizeApplicationIds(args.applicationIds);
  }
  taxonomy.taxonomy = updateTaxonomyNode(taxonomy.taxonomy, taxonomyId, patch);
  const result = await saveWritableTaxonomy(taxonomy, args.workspaceId);
  return {
    item: findTaxonomyNode(result.taxonomy?.taxonomy || [], taxonomyId),
    taxonomy: result.taxonomy,
  };
}

export async function summarizeIssuesForSupport(args: ServiceArguments<"issues_summary" | "issues_aggregate"> = {}) {
  if (args.groupBy) {
    return fetchJson("/api/issues/aggregate", cleanParams(args));
  }

  return fetchJson("/api/issues/summary", cleanParams(args));
}

export async function createIssue(args: ServiceArguments<"issues_create"> = {}) {
  if (!String(args.applicationId || "").trim()) {
    throw new BiawsError("applicationId is required");
  }
  return sendJson(
    "/api/issues",
    {
      ...args,
      createdBy: "biaws-mcp",
      source: {
        kind: "mcp",
        ...(args.source && typeof args.source === "object" ? args.source : {}),
      },
    },
    {},
    "POST",
  );
}

export async function importEml(args: ServiceArguments<"issues_import_eml"> = {}) {
  const filename = String(args.filename || "").trim();
  const contentBase64 = String(args.contentBase64 || "").replaceAll(/\s+/gu, "");
  if (!filename) throw new BiawsError("filename is required");
  if (!filename.toLowerCase().endsWith(".eml")) throw new BiawsError("filename must end with .eml");
  if (!contentBase64) throw new BiawsError("contentBase64 is required");

  const content = Buffer.from(contentBase64, "base64");
  if (!content.length) throw new BiawsError("contentBase64 is invalid or empty");

  const form = new FormData();
  form.append("file", new Blob([content], { type: "message/rfc822" }), filename);
  if (args.type) form.append("type", args.type);
  if (args.id) form.append("id", args.id);
  if (args.title) form.append("title", args.title);
  if (!String(args.applicationId || "").trim()) {
    throw new BiawsError("applicationId is required");
  }
  form.append("applicationId", String(args.applicationId));
  if (args.workspaceId) form.append("workspaceId", args.workspaceId);
  if (args.affectedComponentIds !== undefined) {
    form.append("affectedComponentIds", JSON.stringify(args.affectedComponentIds));
  }
  if (args.classification !== undefined) {
    form.append("classification", JSON.stringify(args.classification));
  }
  if (args.dryRun !== false && args.sanitizationConfig !== undefined) {
    form.append("sanitizationConfig", JSON.stringify(args.sanitizationConfig));
  }

  return sendMultipart("/api/issues/imports/eml", form, {
    dryRun: args.dryRun !== false,
  });
}

function appendOptionalEmlFields(form: FormData, args: Record<string, unknown>) {
  for (const field of ["type", "id", "title", "workspaceId", "applicationId"] as const) {
    const value = String(args[field] || "").trim();
    if (value) form.append(field, value);
  }
  for (const field of ["affectedComponentIds", "classification", "sanitizationConfig"] as const) {
    if (args[field] !== undefined) form.append(field, JSON.stringify(args[field]));
  }
}

function localEmlForm(file: Awaited<ReturnType<typeof readLocalEml>>, args: Record<string, unknown>) {
  const form = new FormData();
  form.append("file", new Blob([Uint8Array.from(file.content)], { type: "message/rfc822" }), file.filename);
  appendOptionalEmlFields(form, args);
  return form;
}

function localEmlMetadata(file: Awaited<ReturnType<typeof readLocalEml>>) {
  return {
    filename: file.filename,
    size: file.size,
    sha256: file.sha256,
  };
}

export async function analyzeEmlFile(args: ServiceArguments<"issues_analyze_eml_file"> = {}) {
  const file = await readLocalEml(args.filePath);
  const result = await sendMultipart("/api/issues/imports/eml", localEmlForm(file, args), {
    analysisOnly: true,
  });
  return {
    ...result,
    localFile: localEmlMetadata(file),
  };
}

export async function importEmlFile(args: ServiceArguments<"issues_import_eml_file"> = {}) {
  const file = await readLocalEml(args.filePath);
  assertExpectedEmlHash(file.sha256, args.expectedSha256);
  if (!String(args.applicationId || "").trim()) throw new BiawsError("applicationId is required");
  const dryRun = args.dryRun !== false;
  const result = await sendMultipart("/api/issues/imports/eml", localEmlForm(file, args), { dryRun });
  return {
    ...result,
    localFile: localEmlMetadata(file),
  };
}

export async function updateIssueState(args: ServiceArguments<"issues_update_state"> = {}) {
  if (!args.issueId) throw new BiawsError("issueId is required");

  return sendJson(
    `/api/issues/${encodeURIComponent(args.issueId)}`,
    cleanParams({
      status: args.status,
      type: args.type,
    }),
    {},
    "PATCH",
  );
}

export async function suggestTaxonomy(args: ServiceArguments<"issues_suggest_taxonomy"> = {}) {
  const limit = Math.min(Number(args.limit || 5), 20);
  let text = `${args.title || ""}\n${args.text || ""}`;
  let applicationId = args.applicationId || "";

  if (args.issueId) {
    const payload = await fetchJson(`/api/issues/${encodeURIComponent(args.issueId)}`);
    if (!payload.issue) throw new BiawsError(`Issue not found: ${args.issueId}`);
    applicationId = payload.issue.applicationId || applicationId;
    text = `${payload.issue.title || ""}\n${payload.issue.text || ""}\n${payload.comments?.map((comment) => comment.text).join("\n") || ""}`;
  }

  const taxonomyPayload = await fetchJson("/api/issues/taxonomy", cleanParams({ applicationId }));
  const nodes = flattenTaxonomy(taxonomyPayload.taxonomy?.taxonomy || []);
  const rawText = tokenize(text).join(" ");
  const tokens = [...new Set(tokenize(text))];

  return {
    issueId: args.issueId || null,
    suggestions: nodes
      .map((node) => ({
        id: node.id,
        label: node.label,
        path: node.path,
        score: scoreTaxonomyNode(node, tokens, rawText),
      }))
      .filter((node) => node.score > 0)
      .sort((first, second) => second.score - first.score || first.path.join("/").localeCompare(second.path.join("/")))
      .slice(0, limit),
  };
}

export async function classifyIssue(args: ServiceArguments<"issues_classify"> = {}) {
  if (!args.issueId) throw new BiawsError("issueId is required");

  return sendJson(`/api/issues/${encodeURIComponent(args.issueId)}/classification`, {
    primaryTaxonomyId: args.primaryTaxonomyId || "",
    secondaryTaxonomyIds: args.secondaryTaxonomyIds || [],
    summary: args.summary || "",
    tags: args.tags || {},
    updatedBy: args.updatedBy || "biaws-mcp",
  });
}

export async function findIssuesByTaxonomy(args: ServiceArguments<"issues_by_taxonomy"> = {}) {
  const taxonomyId = String(args.taxonomyId || "").trim();
  if (!taxonomyId) throw new BiawsError("taxonomyId is required");

  return fetchJson(
    `/api/issues/by-taxonomy/${encodeURIComponent(taxonomyId)}`,
    cleanParams({
      status: args.status,
      type: args.type,
      page: args.page,
      limit: args.limit,
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      componentId: args.componentId,
    }),
  );
}

export async function updateIssue(args: ServiceArguments<"issues_update"> = {}) {
  const issueId = String(args.issueId || "").trim();
  if (!issueId) throw new BiawsError("issueId is required");
  const payload: Record<string, unknown> = {};
  for (const field of [
    "identifier",
    "title",
    "text",
    "type",
    "status",
    "applicationId",
    "affectedComponentIds",
  ] as const) {
    if (args[field] === undefined) continue;
    const value = typeof args[field] === "string" ? args[field].trim() : args[field];
    if (typeof value === "string" && !value && field !== "identifier") throw new BiawsError(`${field} is required`);
    payload[field] = value;
  }
  if (!Object.keys(payload).length) throw new BiawsError("At least one update field is required");
  if (Array.isArray(payload.affectedComponentIds)) {
    const componentIds = payload.affectedComponentIds.map((id) => {
      const value = String(id).trim();
      if (!value) throw new BiawsError("affectedComponentIds must contain nonblank IDs");
      return value;
    });
    if (new Set(componentIds).size !== componentIds.length) {
      throw new BiawsError("affectedComponentIds must be unique");
    }
    payload.affectedComponentIds = componentIds;
  }
  return sendJson(`/api/issues/${encodeURIComponent(issueId)}`, payload, {}, "PATCH");
}
