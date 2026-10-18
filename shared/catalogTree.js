export const MAX_CATALOG_DEPTH = 20;

export function catalogChildren(items, parentId = "") {
  return items.filter((item) => (item.parentId || "") === parentId);
}

export function catalogDescendants(items, id) {
  const descendants = new Set([id]);
  const queue = [id];
  for (let index = 0; index < queue.length; index += 1) {
    for (const item of catalogChildren(items, queue[index])) {
      if (!descendants.has(item.id)) {
        descendants.add(item.id);
        queue.push(item.id);
      }
    }
  }
  return descendants;
}

export function catalogHierarchyError(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    const visited = new Set([item.id]);
    let parentId = item.parentId;
    while (parentId) {
      if (!byId.has(parentId)) return "O item pai deve existir no mesmo catálogo";
      if (visited.has(parentId)) return "Um item não pode conter a si próprio ou um de seus ancestrais";
      visited.add(parentId);
      if (visited.size > MAX_CATALOG_DEPTH) return `O catálogo permite até ${MAX_CATALOG_DEPTH} níveis`;
      parentId = byId.get(parentId).parentId;
    }
  }
  return "";
}

export function moveCatalogItem(items, id, parentId = "", beforeId = "") {
  const item = items.find((entry) => entry.id === id);
  if (!item || id === beforeId || catalogDescendants(items, id).has(parentId)) return items;
  if (parentId && !items.some((entry) => entry.id === parentId)) return items;
  const remaining = items.filter((entry) => entry.id !== id);
  const before = remaining.findIndex((entry) => entry.id === beforeId && (entry.parentId || "") === parentId);
  if (beforeId && before < 0) return items;
  const moved = { ...item, parentId };
  if (!parentId) delete moved.parentId;
  const next = [...remaining];
  next.splice(before < 0 ? next.length : before, 0, moved);
  return catalogHierarchyError(next) ? items : next;
}

export function removeCatalogItem(items, id) {
  const removed = catalogDescendants(items, id);
  return items.filter((item) => !removed.has(item.id));
}
