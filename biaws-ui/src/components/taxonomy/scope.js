export function filterTaxonomyForApplication(nodes = [], applicationId = "") {
  const normalizedApplicationId = String(applicationId || "").trim();

  return (nodes || []).flatMap((node) => {
    const applicationIds = Array.isArray(node?.applicationIds)
      ? node.applicationIds.map(String).filter(Boolean)
      : [];
    const applies =
      applicationIds.length === 0 ||
      (normalizedApplicationId &&
        applicationIds.includes(normalizedApplicationId));
    if (!applies) return [];

    const children = filterTaxonomyForApplication(
      node.children || [],
      normalizedApplicationId,
    );
    return [
      {
        ...node,
        ...(children.length ? { children } : { children: undefined }),
      },
    ];
  });
}

export function findTaxonomyNode(nodes = [], nodeId = "") {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findTaxonomyNode(node.children || [], nodeId);
    if (child) return child;
  }
  return null;
}
