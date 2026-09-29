export function applicationScope(actor, permission) {
  const scope = actor.permissionScopes?.[permission];
  return scope?.workspace ? null : (scope?.applicationIds || []).map(String);
}

export function scopedFilter(actor, permission) {
  const filter = { workspaceId: actor.workspaceId };
  const applicationIds = applicationScope(actor, permission);
  if (applicationIds) filter.applicationId = { $in: applicationIds };
  return filter;
}
