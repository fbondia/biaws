export interface TaxonomyNode {
  id?: string;
  name?: string;
  key?: string;
  children?: TaxonomyNode[];
  applicationIds?: string[];
  [field: string]: unknown;
}
import type { Db } from "mongodb";
import { COLLECTION_NAMES } from "../database/collectionNames.js";

const TAXONOMIES_COLLECTION = COLLECTION_NAMES.TAXONOMIES;
const ACTIVE_TAXONOMY_KEY = "biaws";
const ACTIVE_STATUS = "active";

export function collectTaxonomyIdsWithDescendants(
  nodes: TaxonomyNode[] = [],
  selectedIds: unknown[] = [],
) {
  const selected = new Set(
    selectedIds.map((id) => String(id || "").trim()).filter(Boolean),
  );
  const result = new Set(selected);

  function visit(node: TaxonomyNode, ancestorSelected = false) {
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

export function filterTaxonomyForApplication(
  nodes: TaxonomyNode[] = [],
  applicationId: string | undefined,
): TaxonomyNode[] {
  if (applicationId === undefined) return nodes;

  const normalizedApplicationId = String(applicationId || "").trim();
  return (nodes || []).flatMap((node) => {
    const applicationIds = Array.isArray(node?.applicationIds)
      ? node.applicationIds.map((id) => String(id || "").trim()).filter(Boolean)
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

export function collectTaxonomyIds(nodes: TaxonomyNode[] = []): string[] {
  return (nodes || [])
    .flatMap((node) => [
      String(node?.id || "").trim(),
      ...collectTaxonomyIds(node?.children || []),
    ])
    .filter(Boolean);
}

export async function assertTaxonomyIdsApplicable(
  db: Db,
  taxonomyIds: unknown[] = [],
  workspaceId = "",
  applicationId: string | null = null,
) {
  const normalizedIds = [
    ...new Set(
      taxonomyIds.map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  if (!normalizedIds.length) return;

  const taxonomy = await db
    .collection<{
      workspaceId: string;
      key: string;
      status: string;
      taxonomy: TaxonomyNode[];
    }>(TAXONOMIES_COLLECTION)
    .findOne({
      workspaceId: String(workspaceId || ""),
      key: ACTIVE_TAXONOMY_KEY,
      status: ACTIVE_STATUS,
    });
  const availableIds = new Set(
    collectTaxonomyIds(
      filterTaxonomyForApplication(
        taxonomy?.taxonomy || [],
        String(applicationId || "").trim(),
      ),
    ),
  );
  const unavailable = normalizedIds.filter((id) => !availableIds.has(id));
  if (unavailable.length) {
    const error = new Error(
      `Taxonomy items are not available for the related application: ${unavailable.join(", ")}`,
    );
    error.statusCode = 422;
    error.code = "TAXONOMY_NOT_APPLICABLE";
    throw error;
  }
}

export async function expandTaxonomyIds(
  db: Db,
  taxonomyIds: unknown[] = [],
  workspaceId = "",
) {
  const normalizedIds = [
    ...new Set(
      taxonomyIds.map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  if (!normalizedIds.length) return [];

  const taxonomy = await db
    .collection<{
      workspaceId: string;
      key: string;
      status: string;
      taxonomy: TaxonomyNode[];
    }>(TAXONOMIES_COLLECTION)
    .findOne({
      ...(workspaceId ? { workspaceId: String(workspaceId) } : {}),
      key: ACTIVE_TAXONOMY_KEY,
      status: ACTIVE_STATUS,
    });

  return collectTaxonomyIdsWithDescendants(
    taxonomy?.taxonomy || [],
    normalizedIds,
  );
}
