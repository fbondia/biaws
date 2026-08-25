import {
  cleanParams,
  fetchJson,
  sendJson,
  sendMultipart,
} from "../../httpClient.js";

function flattenTaxonomy(nodes = [], parentPath = []) {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.label || node.id];
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

function findTaxonomyNode(nodes = [], taxonomyId) {
  for (const node of nodes) {
    if (node.id === taxonomyId) return node;
    const child = findTaxonomyNode(node.children || [], taxonomyId);
    if (child) return child;
  }
  return null;
}

function appendTaxonomyNode(nodes = [], parentId, item) {
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

function updateTaxonomyNode(nodes = [], taxonomyId, patch) {
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

function normalizeApplicationIds(value) {
  return [
    ...new Set(
      (value || [])
        .map((applicationId) => String(applicationId || "").trim())
        .filter(Boolean),
    ),
  ];
}

function writableTaxonomyPackage(taxonomy) {
  return {
    schemaVersion: taxonomy.schemaVersion || 1,
    source: taxonomy.source || null,
    tagGroups: taxonomy.tagGroups || [],
    taxonomy: taxonomy.taxonomy || [],
    updatedBy: "biaws-mcp",
  };
}

async function loadWritableTaxonomy(workspaceId) {
  const payload = await fetchJson(
    "/api/issues/taxonomy",
    cleanParams({ workspaceId }),
  );
  if (!payload.taxonomy) throw new Error("Issue taxonomy not found");
  return writableTaxonomyPackage(payload.taxonomy);
}

async function saveWritableTaxonomy(taxonomy, workspaceId) {
  return sendJson(
    "/api/issues/taxonomy",
    taxonomy,
    cleanParams({ workspaceId }),
  );
}

function tokenize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3);
}

function scoreTaxonomyNode(node, tokens, rawText) {
  const normalizedNodeText = node.searchText
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
  let score = 0;

  for (const token of tokens) {
    if (normalizedNodeText.includes(token)) score += 3;
    if (rawText.includes(token)) score += 1;
  }

  return score;
}

export async function searchIssues(args = {}) {
  return fetchJson("/api/issues", cleanParams(args));
}

export async function getIssueDetails(args = {}) {
  if (!args.issueId) throw new Error("issueId is required");
  return fetchJson(`/api/issues/${encodeURIComponent(args.issueId)}`);
}

export async function addIssueComment(args = {}) {
  const issueId = String(args.issueId || "").trim();
  const text = String(args.text || "").trim();
  if (!issueId) throw new Error("issueId is required");
  if (!text) throw new Error("text is required");

  return sendJson(
    `/api/issues/${encodeURIComponent(issueId)}/comments`,
    cleanParams({ text, date: args.date }),
    {},
    "POST",
  );
}

export async function updateIssueComment(args = {}) {
  const issueId = String(args.issueId || "").trim();
  const commentId = String(args.commentId || "").trim();
  const text = String(args.text || "").trim();
  if (!issueId) throw new Error("issueId is required");
  if (!commentId) throw new Error("commentId is required");
  if (!text) throw new Error("text is required");

  return sendJson(
    `/api/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
    cleanParams({ text, date: args.date }),
  );
}

export async function getIssueClassificationCatalog(args = {}) {
  const payload = await fetchJson(
    "/api/issues/taxonomy",
    cleanParams({ applicationId: args.applicationId }),
  );
  const catalog = payload.taxonomy || {};
  const result = {
    meta: payload.meta,
    schemaVersion: catalog.schemaVersion,
    source: catalog.source,
    taxonomy: catalog.taxonomy || [],
    tagGroups: catalog.tagGroups || [],
  };

  if (args.flatten === true) {
    result.taxonomyOptions = flattenTaxonomy(result.taxonomy).map(
      ({ searchText, ...node }) => ({
        ...node,
        pathLabel: node.path.join(" / "),
      }),
    );
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

export async function createTaxonomyItem(args = {}) {
  const id = String(args.id || "").trim();
  const label = String(args.label || "").trim();
  const parentId = String(args.parentId || "").trim();
  if (!id) throw new Error("id is required");
  if (!label) throw new Error("label is required");

  const taxonomy = await loadWritableTaxonomy(args.workspaceId);
  if (findTaxonomyNode(taxonomy.taxonomy, id)) {
    throw new Error(`Taxonomy item already exists: ${id}`);
  }
  const parent = parentId
    ? findTaxonomyNode(taxonomy.taxonomy, parentId)
    : null;
  if (parentId && !parent) {
    throw new Error(`Parent taxonomy item not found: ${parentId}`);
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

export async function updateTaxonomyItem(args = {}) {
  const taxonomyId = String(args.taxonomyId || "").trim();
  if (!taxonomyId) throw new Error("taxonomyId is required");
  if (args.label === undefined && args.applicationIds === undefined) {
    throw new Error("label or applicationIds is required");
  }

  const taxonomy = await loadWritableTaxonomy(args.workspaceId);
  if (!findTaxonomyNode(taxonomy.taxonomy, taxonomyId)) {
    throw new Error(`Taxonomy item not found: ${taxonomyId}`);
  }

  const patch = {};
  if (args.label !== undefined) {
    const label = String(args.label || "").trim();
    if (!label) throw new Error("label must be a non-empty string");
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

export async function summarizeIssuesForSupport(args = {}) {
  if (args.groupBy) {
    return fetchJson("/api/issues/aggregate", cleanParams(args));
  }

  return fetchJson("/api/issues/summary", cleanParams(args));
}

export async function createIssue(args = {}) {
  if (!String(args.applicationId || "").trim()) {
    throw new Error("applicationId is required");
  }
  return sendJson(
    "/api/issues",
    {
      ...args,
      createdBy: args.createdBy || "biaws-mcp",
      source: {
        kind: "mcp",
        ...(args.source && typeof args.source === "object" ? args.source : {}),
      },
    },
    {},
    "POST",
  );
}

export async function importEml(args = {}) {
  const filename = String(args.filename || "").trim();
  const contentBase64 = String(args.contentBase64 || "").replace(/\s+/gu, "");
  if (!filename) throw new Error("filename is required");
  if (!filename.toLowerCase().endsWith(".eml"))
    throw new Error("filename must end with .eml");
  if (!contentBase64) throw new Error("contentBase64 is required");

  const content = Buffer.from(contentBase64, "base64");
  if (!content.length) throw new Error("contentBase64 is invalid or empty");

  const form = new FormData();
  form.append(
    "file",
    new Blob([content], { type: "message/rfc822" }),
    filename,
  );
  if (args.type) form.append("type", args.type);
  if (args.id) form.append("id", args.id);
  if (!String(args.applicationId || "").trim()) {
    throw new Error("applicationId is required");
  }
  form.append("applicationId", args.applicationId);
  if (args.workspaceId) form.append("workspaceId", args.workspaceId);
  if (args.affectedComponentIds !== undefined) {
    form.append(
      "affectedComponentIds",
      JSON.stringify(args.affectedComponentIds),
    );
  }

  return sendMultipart("/api/issues/imports/eml", form, {
    dryRun: args.dryRun !== false,
  });
}

export async function updateIssueState(args = {}) {
  if (!args.issueId) throw new Error("issueId is required");

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

export async function suggestTaxonomy(args = {}) {
  const limit = Math.min(Number(args.limit || 5), 20);
  let text = `${args.title || ""}\n${args.text || ""}`;
  let applicationId = args.applicationId || "";

  if (args.issueId) {
    const payload = await fetchJson(
      `/api/issues/${encodeURIComponent(args.issueId)}`,
    );
    if (!payload.issue) throw new Error(`Issue not found: ${args.issueId}`);
    applicationId = payload.issue.applicationId || applicationId;
    text = `${payload.issue.title || ""}\n${payload.issue.text || ""}\n${payload.comments?.map((comment) => comment.text).join("\n") || ""}`;
  }

  const taxonomyPayload = await fetchJson(
    "/api/issues/taxonomy",
    cleanParams({ applicationId }),
  );
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
      .sort(
        (first, second) =>
          second.score - first.score ||
          first.path.join("/").localeCompare(second.path.join("/")),
      )
      .slice(0, limit),
  };
}

export async function classifyIssue(args = {}) {
  if (!args.issueId) throw new Error("issueId is required");

  return sendJson(
    `/api/issues/${encodeURIComponent(args.issueId)}/classification`,
    {
      primaryTaxonomyId: args.primaryTaxonomyId || "",
      secondaryTaxonomyIds: args.secondaryTaxonomyIds || [],
      summary: args.summary || "",
      tags: args.tags || {},
      updatedBy: args.updatedBy || "biaws-mcp",
    },
  );
}

export async function findIssuesByTaxonomy(args = {}) {
  const taxonomyId = String(args.taxonomyId || "").trim();
  if (!taxonomyId) throw new Error("taxonomyId is required");

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
