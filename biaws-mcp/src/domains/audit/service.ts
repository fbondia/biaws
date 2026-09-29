import type { ServiceArguments } from "../../contracts.js";
import { BiawsError } from "../../errors.js";
import { cleanParams, fetchJson } from "../../httpClient.js";

export async function listAuditEvents(
  args: ServiceArguments<"audit_events_list"> = {},
) {
  const entityId = String(args.entityId || "").trim();
  if (!entityId) throw new BiawsError("entityId is required");
  return fetchJson(
    `/api/audit/${encodeURIComponent(String(args.entityType))}/${encodeURIComponent(entityId)}`,
    cleanParams({ limit: args.limit ?? 100 }),
  );
}
