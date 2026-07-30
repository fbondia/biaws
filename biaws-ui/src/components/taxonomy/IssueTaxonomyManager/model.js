export const EMPTY_CATALOG = {
  schemaVersion: 1,
  source: null,
  tagGroups: [],
  taxonomy: [],
};

export const TAG_GROUP_ALIASES = {
  ambientes: {
    id: "ambiente",
    label: "Ambiente",
    description: "Tags relacionadas ao ambiente onde o issue ocorreu.",
  },
  componentes: {
    id: "componente",
    label: "Componente afetado",
    description: "Componentes técnicos ou operacionais impactados.",
  },
  features: {
    id: "feature",
    label: "Feature",
    description: "Processos e regras de negócio do workspace.",
  },
  integracoes: {
    id: "integracao",
    label: "Integração",
    description: "Sistemas externos e fluxos integrados.",
  },
  tratamentos: {
    id: "tratamento",
    label: "Tratamento",
    description:
      "Tipo de análise, correção ou encaminhamento aplicado ao issue.",
  },
};

export function cloneCatalog(catalog) {
  return JSON.parse(JSON.stringify(catalog));
}

export function editableCatalog(catalog) {
  const tagGroups = normalizeTagGroups(catalog?.tagGroups);
  const taxonomy = normalizeTaxonomy(catalog?.taxonomy);

  return {
    schemaVersion: catalog?.schemaVersion || 1,
    source: catalog?.source || null,
    tagGroups,
    taxonomy,
  };
}

export function serializeCatalog(catalog) {
  return JSON.stringify(editableCatalog(catalog));
}

export function downloadJsonFile(payload, fileName) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportFileName(catalog) {
  const uploadedFileName = catalog?.source?.uploadedFileName;
  if (uploadedFileName && /\.json$/iu.test(uploadedFileName)) {
    return uploadedFileName;
  }

  return "issue-taxonomy-catalog.json";
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

export function normalizeTagGroups(tagGroups) {
  if (Array.isArray(tagGroups)) {
    return tagGroups.map((group) => ({
      id: group.id,
      label: group.label,
      description: group.description || "",
      color: group.color || DEFAULT_TAG_GROUP_COLOR,
      tags: Array.isArray(group.tags) ? group.tags : [],
    }));
  }

  if (!tagGroups || typeof tagGroups !== "object") return [];

  return Object.entries(tagGroups)
    .filter(([groupId]) => groupId !== "assuntos")
    .map(([groupId, tags]) => {
      const alias = TAG_GROUP_ALIASES[groupId] || {
        id: slugify(groupId),
        label: groupId,
        description: "",
      };

      return {
        ...alias,
        color: DEFAULT_TAG_GROUP_COLOR,
        tags: Array.isArray(tags) ? tags : [],
      };
    });
}

export function compactTreeNode(node) {
  const children = Array.isArray(node.children)
    ? node.children.map(compactTreeNode)
    : [];
  const compacted = {
    id: node.id,
    label: node.label,
  };

  if (children.length) {
    compacted.children = children;
  }

  return compacted;
}

export function flatTaxonomyToTree(rows) {
  const nodesByPathId = new Map();

  for (const row of rows) {
    const pathId = row.pathId || row.id;
    nodesByPathId.set(pathId, {
      id: row.id || pathId,
      label: row.label || row.id || pathId,
      parentPathId: row.parentPathId || null,
      sourceLine: row.sourceLine || 0,
      children: [],
    });
  }

  const roots = [];
  const sortedNodes = [...nodesByPathId.entries()].sort(
    ([, first], [, second]) => {
      return first.sourceLine - second.sourceLine;
    },
  );

  for (const [, node] of sortedNodes) {
    if (node.parentPathId && nodesByPathId.has(node.parentPathId)) {
      nodesByPathId.get(node.parentPathId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots.map(compactTreeNode);
}

export function normalizeTaxonomy(taxonomy) {
  if (!Array.isArray(taxonomy)) return [];

  const looksFlat = taxonomy.some(
    (node) =>
      Object.hasOwn(node, "parentPathId") || Object.hasOwn(node, "pathId"),
  );

  if (looksFlat) {
    return flatTaxonomyToTree(taxonomy);
  }

  return taxonomy.map(compactTreeNode);
}

export function flattenTree(nodes, depth = 0, parentId = null, path = []) {
  return nodes.flatMap((node) => {
    const currentPath = [...path, node.label];
    const current = {
      ...node,
      depth,
      parentId,
      path: currentPath,
    };

    return [
      current,
      ...flattenTree(node.children || [], depth + 1, node.id, currentPath),
    ];
  });
}

export function updateNode(nodes, nodeId, patch) {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, ...patch };
    }

    return {
      ...node,
      children: node.children
        ? updateNode(node.children, nodeId, patch)
        : undefined,
    };
  });
}

export function appendChild(nodes, parentId, child) {
  if (!parentId) return [...nodes, child];

  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), child],
      };
    }

    return {
      ...node,
      children: node.children
        ? appendChild(node.children, parentId, child)
        : undefined,
    };
  });
}

export function removeNode(nodes, nodeId) {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({
      ...node,
      children: node.children ? removeNode(node.children, nodeId) : undefined,
    }));
}

export function hasNode(nodes, nodeId) {
  return nodes.some(
    (node) => node.id === nodeId || hasNode(node.children || [], nodeId),
  );
}

export function countNodes(nodes) {
  return flattenTree(nodes).length;
}

export function groupTagCount(groups) {
  return groups.reduce((total, group) => total + group.tags.length, 0);
}
