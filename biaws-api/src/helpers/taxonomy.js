import { COLLECTION_NAMES } from "../database/collectionNames.js";

const TAXONOMIES_COLLECTION = COLLECTION_NAMES.TAXONOMIES;
const ACTIVE_TAXONOMY_KEY = "biaws";
const ACTIVE_STATUS = "active";

export function collectTaxonomyIdsWithDescendants(
  nodes = [],
  selectedIds = [],
) {
  const selected = new Set(
    selectedIds.map((id) => String(id || "").trim()).filter(Boolean),
  );
  const result = new Set(selected);

  function visit(node, ancestorSelected = false) {
    const id = String(node?.id || "").trim();
    const included = ancestorSelected || selected.has(id);
    if (included && id) result.add(id);

    for (const child of node?.children || []) {
      visit(child, included);
    }
  }

  for (const node of nodes || []) visit(node);
  return [...result];
}

export async function expandTaxonomyIds(
  db,
  taxonomyIds = [],
  workspaceId = "",
) {
  const normalizedIds = [
    ...new Set(
      taxonomyIds.map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  if (!normalizedIds.length) return [];

  const taxonomy = await db.collection(TAXONOMIES_COLLECTION).findOne({
    ...(workspaceId ? { workspaceId: String(workspaceId) } : {}),
    key: ACTIVE_TAXONOMY_KEY,
    status: ACTIVE_STATUS,
  });

  return collectTaxonomyIdsWithDescendants(
    taxonomy?.taxonomy || [],
    normalizedIds,
  );
}
