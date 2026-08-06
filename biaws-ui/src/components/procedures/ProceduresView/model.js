export const EMPTY_DRAFT = {
  id: "",
  title: "",
  summary: "",
  procedure: "",
  collectionId: "",
  applicationId: "",
  affectedComponentIds: [],
  classification: { primaryTaxonomyId: "", secondaryTaxonomyIds: [], tags: {} },
};

export function flattenTaxonomy(nodes = [], path = []) {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node.label];
    return [
      { ...node, path: nextPath },
      ...flattenTaxonomy(node.children || [], nextPath),
    ];
  });
}

export function normalizeDraft(procedure = {}) {
  return {
    ...EMPTY_DRAFT,
    ...procedure,
    classification: {
      ...EMPTY_DRAFT.classification,
      ...(procedure.classification || {}),
      secondaryTaxonomyIds:
        procedure.classification?.secondaryTaxonomyIds || [],
      tags: procedure.classification?.tags || {},
    },
    applicationId: procedure.applicationId || "",
    affectedComponentIds: procedure.affectedComponentIds || [],
  };
}

export function selectedTaxonomyIds(classification) {
  return [
    ...new Set(
      [
        classification.primaryTaxonomyId,
        ...(classification.secondaryTaxonomyIds || []),
      ].filter(Boolean),
    ),
  ];
}

export function taxonomyById(nodes) {
  return Object.fromEntries(
    flattenTaxonomy(nodes).map((node) => [node.id, node]),
  );
}
