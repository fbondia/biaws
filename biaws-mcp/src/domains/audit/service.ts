import type { ServiceArguments } from "../../mcp/tools/contracts.js";
import { BiawsError } from "../../runtime/errors.js";
import { cleanParams, fetchJson } from "../../api/httpClient.js";

export async function listAuditEvents(args: ServiceArguments<"audit_events_list"> = {}) {
  const entityId = String(args.entityId || "").trim();
  if (!entityId) throw new BiawsError("entityId is required");
  return fetchJson(
    `/api/audit/${encodeURIComponent(String(args.entityType))}/${encodeURIComponent(entityId)}`,
    cleanParams({ limit: args.limit ?? 100 }),
  );
}
