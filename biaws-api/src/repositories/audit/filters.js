export function buildAuditFilter(rootType, rootId) {
  return {
    $or: [
      { rootType, rootId: String(rootId) },
      { "target.type": rootType, "target.id": String(rootId) },
    ],
  };
}
