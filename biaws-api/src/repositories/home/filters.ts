import type { Actor } from "../../types/http.js";
export function applicationScope(actor: Partial<Actor>, permission: string) {
  const scope = actor.permissionScopes?.[permission];
  return scope?.workspace ? null : (scope?.applicationIds || []).map(String);
}

export function scopedFilter(actor: Partial<Actor>, permission: string) {
  const filter: {
    workspaceId: string | null | undefined;
    applicationId?: { $in: string[] };
  } = { workspaceId: actor.workspaceId };
  const applicationIds = applicationScope(actor, permission);
  if (applicationIds) filter.applicationId = { $in: applicationIds };
  return filter;
}
