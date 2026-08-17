export function slugifyTaxonomyNode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

export function hasTaxonomyNode(nodes = [], nodeId) {
  return nodes.some(
    (node) =>
      node.id === nodeId || hasTaxonomyNode(node.children || [], nodeId),
  );
}

export function buildUniqueTaxonomyId(nodes, parentId, label) {
  const baseId = slugifyTaxonomyNode(label) || "novo-no";
  const parentPrefix = parentId ? `${parentId}-${baseId}` : baseId;
  let nextId = parentPrefix;
  let suffix = 2;

  while (hasTaxonomyNode(nodes, nextId)) {
    nextId = `${parentPrefix}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}
