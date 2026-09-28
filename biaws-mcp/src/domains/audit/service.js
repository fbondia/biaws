import { cleanParams, fetchJson } from "../../httpClient.js";

export async function listAuditEvents(args = {}) {
  const entityId = String(args.entityId || "").trim();
  if (!entityId) throw new Error("entityId is required");
  return fetchJson(
    `/api/audit/${encodeURIComponent(args.entityType)}/${encodeURIComponent(entityId)}`,
    cleanParams({ limit: args.limit ?? 100 }),
  );
}
