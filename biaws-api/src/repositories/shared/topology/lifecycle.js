export function actorId(actor) {
  return String(actor?.userId || actor?.email || "system").trim();
}

export function createBaseDocument({
  key,
  workspaceId,
  applicationId,
  actor,
  now = new Date(),
}) {
  return {
    key,
    workspaceId: String(workspaceId),
    ...(applicationId ? { applicationId: String(applicationId) } : {}),
    status: "active",
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
}

export function archiveFields(actor, now = new Date()) {
  return {
    status: "archived",
    archivedAt: now,
    archivedBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
}
