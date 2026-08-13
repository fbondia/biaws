import { DEFAULT_TAG_GROUP_COLOR } from "../../../constants/issues.js";

export function buildTagGroupsById(taxonomyPackage) {
  return Object.fromEntries(
    (taxonomyPackage?.tagGroups || []).map((group) => [group.id, group]),
  );
}

export function buildTaxonomyItemsById(nodes = [], path = []) {
  return nodes.reduce((itemsById, node) => {
    const currentPath = [...path, node.label];

    return {
      ...itemsById,
      [node.id]: {
        id: node.id,
        label: node.label,
        path: currentPath,
      },
      ...buildTaxonomyItemsById(node.children || [], currentPath),
    };
  }, {});
}

function taxonomyItem(taxonomyId, taxonomyItemsById) {
  return (
    taxonomyItemsById[taxonomyId] || {
      id: taxonomyId,
      label: taxonomyId,
      path: [taxonomyId],
    }
  );
}

export function issueTaxonomyItems(issue, taxonomyItemsById) {
  const primaryTaxonomyId = issue.classification?.primaryTaxonomyId || "";
  const taxonomyIds = [
    primaryTaxonomyId,
    ...(Array.isArray(issue.classification?.secondaryTaxonomyIds)
      ? issue.classification.secondaryTaxonomyIds
      : []),
  ].filter(Boolean);

  return [...new Set(taxonomyIds)].map((taxonomyId) => ({
    ...taxonomyItem(taxonomyId, taxonomyItemsById),
    isPrimary: taxonomyId === primaryTaxonomyId,
  }));
}

export function issueTagItems(issue, tagGroupsById) {
  const tags = issue.classification?.tags || {};

  return Object.entries(tags).flatMap(([groupId, tagIds]) => {
    const group = tagGroupsById[groupId] || {
      id: groupId,
      label: groupId,
      color: DEFAULT_TAG_GROUP_COLOR,
    };

    return (Array.isArray(tagIds) ? tagIds : []).map((tagId) => ({
      group,
      tagId,
    }));
  });
}

export function optionLabel(options, value) {
  return (
    options.find((option) => option.value === value)?.label || value || "-"
  );
}
