export function buildAuditFilter(rootType: string, rootId: string) {
  return {
    $or: [
      { rootType, rootId: String(rootId) },
      { "target.type": rootType, "target.id": String(rootId) },
    ],
  };
}
