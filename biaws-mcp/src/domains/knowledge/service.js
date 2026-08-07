import { cleanParams, fetchJson, sendJson } from "../../httpClient.js";

const TYPE_CONFIG = Object.freeze({
  "business-rules": { key: "businessRule", activeStatus: "active" },
  "architecture-decisions": {
    key: "architectureDecision",
    activeStatus: "accepted",
  },
});

function config(type) {
  const value = TYPE_CONFIG[type];
  if (!value) throw new Error(`unsupported knowledge type: ${type}`);
  return value;
}

function basePath(type) {
  config(type);
  return `/api/knowledge/${type}`;
}

function recordPayload(args = {}, current = {}) {
  return {
    title: args.title ?? current.title,
    markdown: args.markdown ?? current.markdown,
    applicationId: args.applicationId ?? current.applicationId,
    affectedComponentIds:
      args.affectedComponentIds ?? current.affectedComponentIds ?? [],
    collectionId: args.collectionId ?? current.collectionId ?? "",
    status: args.status ?? current.status,
    references: args.references ?? current.references ?? [],
    definedAt: args.definedAt ?? current.definedAt,
    lastReviewedAt: args.lastReviewedAt ?? current.lastReviewedAt ?? "",
    nextReviewAt: args.nextReviewAt ?? current.nextReviewAt ?? "",
    changeSummary: args.changeSummary,
  };
}

export async function searchKnowledgeRecords(type, args = {}) {
  return fetchJson(
    basePath(type),
    cleanParams({
      search: args.search ?? args.q,
      applicationId: args.applicationId,
      componentId: args.componentId,
      collectionId: args.collectionId,
      status: args.status,
      includeArchived: args.includeArchived,
      page: args.page,
      limit: args.limit,
    }),
  );
}

export async function getKnowledgeRecord(type, args = {}) {
  const recordId = String(args.recordId || "").trim();
  if (!recordId) throw new Error("recordId is required");
  return fetchJson(`${basePath(type)}/${encodeURIComponent(recordId)}`);
}

export async function createKnowledgeRecord(type, args = {}) {
  if (!String(args.title || "").trim()) throw new Error("title is required");
  if (!String(args.markdown || "").trim())
    throw new Error("markdown is required");
  if (!String(args.applicationId || "").trim())
    throw new Error("applicationId is required");
  return sendJson(basePath(type), recordPayload(args), {}, "POST");
}

export async function updateKnowledgeRecord(type, args = {}) {
  const recordId = String(args.recordId || "").trim();
  if (!recordId) throw new Error("recordId is required");
  const currentPayload = await getKnowledgeRecord(type, { recordId });
  const current = currentPayload[config(type).key];
  return sendJson(
    `${basePath(type)}/${encodeURIComponent(recordId)}`,
    recordPayload(args, current),
    {},
    "PUT",
  );
}

export async function addKnowledgeObservation(type, args = {}) {
  const recordId = String(args.recordId || "").trim();
  const markdown = String(args.markdown || "").trim();
  if (!recordId) throw new Error("recordId is required");
  if (!markdown) throw new Error("markdown is required");
  return sendJson(
    `${basePath(type)}/${encodeURIComponent(recordId)}/observations`,
    { markdown },
    {},
    "POST",
  );
}

async function loadFullRecords(type, args) {
  const typeConfig = config(type);
  const list = await searchKnowledgeRecords(type, {
    applicationId: args.applicationId,
    componentId: args.componentId,
    status: typeConfig.activeStatus,
    limit: args.limit,
  });
  const items = list.items || [];
  if (args.includeMarkdown === false) return items;
  return Promise.all(
    items.map(async ({ id }) => {
      const payload = await getKnowledgeRecord(type, { recordId: id });
      return payload[typeConfig.key];
    }),
  );
}

export async function loadKnowledgeContext(args = {}) {
  const applicationId = String(args.applicationId || "").trim();
  if (!applicationId) throw new Error("applicationId is required");
  const options = { ...args, applicationId, limit: args.limit || 25 };
  const [businessRules, architectureDecisions] = await Promise.all([
    loadFullRecords("business-rules", options),
    loadFullRecords("architecture-decisions", options),
  ]);
  return {
    applicationId,
    componentId: args.componentId || null,
    businessRules,
    architectureDecisions,
  };
}
