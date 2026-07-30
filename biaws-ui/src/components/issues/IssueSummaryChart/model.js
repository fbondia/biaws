import {
  ALL_STATUS_OPTIONS,
  ALL_TYPE_OPTIONS,
} from "../../../constants/issues.js";

export const CHART_COLORS = [
  "#2d6cdf",
  "#246b49",
  "#d98f1f",
  "#8b5cf6",
  "#c2410c",
  "#0f766e",
  "#64748b",
];

export const CHART_TYPES = {
  byDate: "line",
  byWeek: "line",
  byMonth: "bar",
  byYear: "bar",
  byType: "pie",
  byStatus: "pie",
  byTaxonomy: "taxonomy",
};

export function chartLabel(value) {
  return (
    [...ALL_TYPE_OPTIONS, ...ALL_STATUS_OPTIONS].find(
      (option) => option.value === value,
    )?.label ||
    value ||
    "sem valor"
  );
}

export function chartData(items) {
  return items.map((item, index) => ({
    ...item,
    color: CHART_COLORS[index % CHART_COLORS.length],
    name: chartLabel(item.key),
  }));
}

export function taxonomyItemMap(items) {
  return new Map(
    items
      .map((item) => [
        String(item.key || "").trim(),
        {
          count: item.count || 0,
          issues: Array.isArray(item.issues) ? item.issues : [],
        },
      ])
      .filter(([taxonomyId, item]) => taxonomyId && item.count > 0),
  );
}

export function collectTaxonomyIds(nodes = [], ids = new Set()) {
  for (const node of nodes) {
    ids.add(node.id);
    collectTaxonomyIds(node.children || [], ids);
  }

  return ids;
}

export function buildTaxonomySummaryNode(
  node,
  itemsById,
  path = [],
  depth = 0,
) {
  const nextPath = [...path, node.label || node.id];
  const children = (node.children || [])
    .map((child) =>
      buildTaxonomySummaryNode(child, itemsById, nextPath, depth + 1),
    )
    .filter(Boolean);
  const directItem = itemsById.get(node.id);
  const directCount = directItem?.count || 0;
  const totalCount = children.reduce(
    (total, child) => total + child.totalCount,
    directCount,
  );

  if (!totalCount) return null;

  return {
    id: node.id,
    label: node.label || node.id,
    path: nextPath,
    depth,
    directCount,
    totalCount,
    issues: directItem?.issues || [],
    children,
  };
}

export function flattenTaxonomySummary(nodes = []) {
  return nodes.flatMap((node) => [
    node,
    ...flattenTaxonomySummary(node.children),
  ]);
}
