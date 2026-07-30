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

export async function getIssueClassificationCatalog(args = {}) {
  const payload = await fetchJson("/api/issues/taxonomy");
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

  if (args.issueId) {
    const payload = await fetchJson(
      `/api/issues/${encodeURIComponent(args.issueId)}`,
    );
    if (!payload.issue) throw new Error(`Issue not found: ${args.issueId}`);
    text = `${payload.issue.title || ""}\n${payload.issue.text || ""}\n${payload.comments?.map((comment) => comment.text).join("\n") || ""}`;
  }

  const taxonomyPayload = await fetchJson("/api/issues/taxonomy");
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
