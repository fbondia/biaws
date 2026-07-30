import { fetchJson } from "./client.js";

export function fetchAuditHistory(entityType, entityId, params) {
  return fetchJson(
    `/api/audit/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    params,
  );
}
