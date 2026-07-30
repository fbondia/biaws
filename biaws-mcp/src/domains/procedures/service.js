import { cleanParams, fetchJson, sendJson } from "../../httpClient.js";

function flattenTaxonomy(nodes = [], parentPath = []) {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.label || node.id];
    return [
      { id: node.id, label: node.label, path },
      ...flattenTaxonomy(node.children || [], path),
    ];
  });
}

function classificationPayload(args = {}, current = {}) {
  const supplied =
    args.classification && typeof args.classification === "object"
      ? args.classification
      : args;

  return {
    primaryTaxonomyId:
      supplied.primaryTaxonomyId ?? current.primaryTaxonomyId ?? "",
    secondaryTaxonomyIds:
      supplied.secondaryTaxonomyIds ?? current.secondaryTaxonomyIds ?? [],
    tags: supplied.tags ?? current.tags ?? {},
  };
}

function contextPayload(args = {}, current = {}) {
  return {
    ...(Object.hasOwn(args, "workspaceId")
      ? { workspaceId: args.workspaceId }
      : current.workspaceId
        ? { workspaceId: current.workspaceId }
        : {}),
    ...(Object.hasOwn(args, "applicationId")
      ? { applicationId: args.applicationId }
      : Object.hasOwn(current, "applicationId")
        ? { applicationId: current.applicationId }
        : {}),
    ...(Object.hasOwn(args, "affectedComponentIds")
      ? { affectedComponentIds: args.affectedComponentIds }
      : Array.isArray(current.affectedComponentIds)
        ? { affectedComponentIds: current.affectedComponentIds }
        : {}),
  };
}

export async function searchProcedures(args = {}) {
  if (args.procedureId) {
    return fetchJson(`/api/procedures/${encodeURIComponent(args.procedureId)}`);
  }

  return fetchJson(
    "/api/procedures",
    cleanParams({
      search: args.search ?? args.text ?? args.q,
      taxonomyId: args.taxonomyId,
      tagGroupId: args.tagGroupId,
      tagId: args.tagId,
      page: args.page,
      limit: args.limit,
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      componentId: args.componentId,
    }),
  );
}

export async function getProcedureClassificationCatalog(args = {}) {
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
    result.taxonomyOptions = flattenTaxonomy(result.taxonomy).map((node) => ({
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

export async function createProcedure(args = {}) {
  const title = String(args.title || "").trim();
  const summary = String(args.summary || "").trim();
  const procedure = String(args.procedure || "").trim();
  if (!title) throw new Error("title is required");
  if (!summary) throw new Error("summary is required");
  if (!procedure) throw new Error("procedure is required");

  return sendJson(
    "/api/procedures",
    {
      title,
      summary,
      procedure,
      classification: classificationPayload(args),
      ...contextPayload(args),
    },
    {},
    "POST",
  );
}

export async function updateProcedure(args = {}) {
  const procedureId = String(args.procedureId || "").trim();
  if (!procedureId) throw new Error("procedureId is required");

  const currentPayload = await fetchJson(
    `/api/procedures/${encodeURIComponent(procedureId)}`,
  );
  const current = currentPayload.procedure;
  if (!current) throw new Error(`Procedure not found: ${procedureId}`);

  const title = String(args.title ?? current.title ?? "").trim();
  const summary = String(args.summary ?? current.summary ?? "").trim();
  const procedure = String(args.procedure ?? current.procedure ?? "").trim();
  if (!title) throw new Error("title is required");
  if (!summary) throw new Error("summary is required");
  if (!procedure) throw new Error("procedure is required");

  return sendJson(`/api/procedures/${encodeURIComponent(procedureId)}`, {
    title,
    summary,
    procedure,
    collectionId: current.collectionId || "",
    classification: classificationPayload(args, current.classification),
    ...contextPayload(args, current),
  });
}
