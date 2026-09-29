import type { AuthorizationScope } from "../../types/http.js";
import { auditCollection } from "./storage.js";
import { buildAuditFilter } from "./filters.js";

export async function listAuditEvents(
  rootType: string | string[],
  rootId: string | string[],
  { authorizationScope, limit = 100 }: { authorizationScope?: AuthorizationScope; limit?: number } = {},
) {
  const collection = await auditCollection();
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const filter: Record<string, unknown> = buildAuditFilter(String(rootType), String(rootId));
  if (authorizationScope?.workspaceId) {
    filter["metadata.workspaceId"] = authorizationScope.workspaceId;
  }
  if (authorizationScope && authorizationScope.workspace !== true) {
    filter["metadata.applicationId"] = {
      $in: (authorizationScope.applicationIds || []).map(String),
    };
  }
  const events = await collection.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(safeLimit).toArray();
  return events.map(({ _id, ...event }) => ({ ...event, id: _id.toString() }));
}
