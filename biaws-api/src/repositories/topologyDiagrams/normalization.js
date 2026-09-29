import {
  MAX_COORDINATE,
  MAX_NODES,
  MAX_NODE_ID_LENGTH,
  MAX_EDGES,
  TOPOLOGY_CONNECTION_HANDLES,
  TOPOLOGY_CONNECTION_TYPES,
  TOPOLOGY_CONNECTION_DIRECTIONS,
  TOPOLOGY_CONNECTION_LINE_TYPES,
  MAX_LABEL_LENGTH,
  MAX_VISIBILITY_IDS,
  MAX_GROUPS,
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_ELEMENTS,
  MAX_COMMENTS_LENGTH,
} from "./constants.js";
import { normalizedName } from "./support.js";
import { DEPLOYMENT_ENVIRONMENTS } from "../../../../shared/index.js";
import {
  assertAllowedFields,
  normalizeDocument,
  normalizeEnum,
  optionalText,
  requiredText,
} from "../shared/topology/normalization.js";
import { createCatalogError } from "../shared/topology/errors.js";

function normalizeCoordinate(value, field) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || Math.abs(coordinate) > MAX_COORDINATE) {
    throw createCatalogError(
      422,
      "INVALID_TOPOLOGY_DIAGRAM",
      `${field} must be a finite coordinate`,
    );
  }
  return coordinate;
}

function normalizeHeaderColor(value, field) {
  if (value === undefined || value === null || value === "") return "#edf9f5";
  const color = String(value).trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/u.test(color)) {
    throw createCatalogError(
      422,
      "INVALID_TOPOLOGY_DIAGRAM",
      `${field} must be a hexadecimal color`,
    );
  }
  return color;
}

export function normalizeDiagramNodes(value, current = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > MAX_NODES) {
    throw createCatalogError(
      422,
      "INVALID_TOPOLOGY_DIAGRAM",
      `nodes must be an array with at most ${MAX_NODES} items`,
    );
  }
  const unique = new Set();
  return value.map((node, index) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `nodes[${index}] must be an object`,
      );
    }
    assertAllowedFields(
      node,
      ["id", "position", "parentId"],
      `nodes[${index}]`,
    );
    const id = requiredText(node.id, `nodes[${index}].id`, MAX_NODE_ID_LENGTH);
    if (unique.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `node is repeated: ${id}`,
      );
    }
    unique.add(id);
    if (
      !node.position ||
      typeof node.position !== "object" ||
      Array.isArray(node.position)
    ) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `nodes[${index}].position must be an object`,
      );
    }
    assertAllowedFields(node.position, ["x", "y"], `nodes[${index}].position`);
    const parentId = optionalText(
      node.parentId,
      `nodes[${index}].parentId`,
      MAX_NODE_ID_LENGTH,
    );
    return {
      id,
      position: {
        x: normalizeCoordinate(node.position.x, `nodes[${index}].position.x`),
        y: normalizeCoordinate(node.position.y, `nodes[${index}].position.y`),
      },
      ...(parentId ? { parentId } : {}),
    };
  });
}

export function normalizeDiagramEdges(value, nodeIds, current = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > MAX_EDGES) {
    throw createCatalogError(
      422,
      "INVALID_TOPOLOGY_DIAGRAM",
      `edges must be an array with at most ${MAX_EDGES} items`,
    );
  }
  const unique = new Set();
  return value.map((edge, index) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `edges[${index}] must be an object`,
      );
    }
    assertAllowedFields(
      edge,
      [
        "id",
        "source",
        "target",
        "sourceHandle",
        "targetHandle",
        "connectionType",
        "direction",
        "lineType",
        "label",
      ],
      `edges[${index}]`,
    );
    const id = requiredText(edge.id, `edges[${index}].id`, MAX_NODE_ID_LENGTH);
    const source = requiredText(
      edge.source,
      `edges[${index}].source`,
      MAX_NODE_ID_LENGTH,
    );
    const target = requiredText(
      edge.target,
      `edges[${index}].target`,
      MAX_NODE_ID_LENGTH,
    );
    if (unique.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `edge is repeated: ${id}`,
      );
    }
    if (source === target) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `edges[${index}] cannot connect a node to itself`,
      );
    }
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `edges[${index}] must reference nodes from the diagram`,
      );
    }
    unique.add(id);
    return {
      id,
      source,
      target,
      sourceHandle: normalizeEnum(
        edge.sourceHandle,
        `edges[${index}].sourceHandle`,
        TOPOLOGY_CONNECTION_HANDLES,
        "",
      ),
      targetHandle: normalizeEnum(
        edge.targetHandle,
        `edges[${index}].targetHandle`,
        TOPOLOGY_CONNECTION_HANDLES,
        "",
      ),
      connectionType: normalizeEnum(
        edge.connectionType,
        `edges[${index}].connectionType`,
        TOPOLOGY_CONNECTION_TYPES,
        "dependency",
      ),
      direction: normalizeEnum(
        edge.direction,
        `edges[${index}].direction`,
        TOPOLOGY_CONNECTION_DIRECTIONS,
        "forward",
      ),
      lineType: normalizeEnum(
        edge.lineType,
        `edges[${index}].lineType`,
        TOPOLOGY_CONNECTION_LINE_TYPES,
        "default",
      ),
      label: optionalText(
        edge.label,
        `edges[${index}].label`,
        MAX_LABEL_LENGTH,
      ),
    };
  });
}

export function normalizeDiagramVisibilityIds(
  value,
  current = [],
  field = "visibilityIds",
) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > MAX_VISIBILITY_IDS) {
    throw createCatalogError(
      422,
      "INVALID_TOPOLOGY_DIAGRAM",
      `${field} must be an array with at most ${MAX_VISIBILITY_IDS} items`,
    );
  }
  const unique = new Set();
  return value.map((item, index) => {
    const id = requiredText(item, `${field}[${index}]`, MAX_NODE_ID_LENGTH);
    if (unique.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `${field} contains a repeated id: ${id}`,
      );
    }
    unique.add(id);
    return id;
  });
}

export function normalizeDiagramGroups(value, current = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > MAX_GROUPS) {
    throw createCatalogError(
      422,
      "INVALID_TOPOLOGY_DIAGRAM",
      `groups must be an array with at most ${MAX_GROUPS} items`,
    );
  }
  const unique = new Set();
  return value.map((group, index) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `groups[${index}] must be an object`,
      );
    }
    assertAllowedFields(
      group,
      ["id", "title", "description"],
      `groups[${index}]`,
    );
    const id = requiredText(
      group.id,
      `groups[${index}].id`,
      MAX_NODE_ID_LENGTH,
    );
    if (unique.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `group is repeated: ${id}`,
      );
    }
    unique.add(id);
    return {
      id,
      title: requiredText(group.title, `groups[${index}].title`, 120),
      description: optionalText(
        group.description,
        `groups[${index}].description`,
        MAX_GROUP_DESCRIPTION_LENGTH,
      ),
    };
  });
}

export function normalizeDiagramElements(value, current = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > MAX_ELEMENTS) {
    throw createCatalogError(
      422,
      "INVALID_TOPOLOGY_DIAGRAM",
      `elements must be an array with at most ${MAX_ELEMENTS} items`,
    );
  }
  const unique = new Set();
  return value.map((element, index) => {
    if (!element || typeof element !== "object" || Array.isArray(element)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `elements[${index}] must be an object`,
      );
    }
    assertAllowedFields(
      element,
      ["id", "type", "title", "description", "headerColor"],
      `elements[${index}]`,
    );
    const id = requiredText(
      element.id,
      `elements[${index}].id`,
      MAX_NODE_ID_LENGTH,
    );
    if (unique.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `element is repeated: ${id}`,
      );
    }
    unique.add(id);
    return {
      id,
      type:
        optionalText(element.type, `elements[${index}].type`, 80) || "Elemento",
      title: requiredText(element.title, `elements[${index}].title`, 120),
      description: optionalText(
        element.description,
        `elements[${index}].description`,
        MAX_GROUP_DESCRIPTION_LENGTH,
      ),
      headerColor: normalizeHeaderColor(
        element.headerColor,
        `elements[${index}].headerColor`,
      ),
    };
  });
}

export function normalizeDiagramPayload(payload, current = {}) {
  assertAllowedFields(
    payload,
    [
      "name",
      "environment",
      "nodes",
      "edges",
      "comments",
      "elements",
      "groups",
      "hiddenIntegrationIds",
      "hiddenServerIds",
    ],
    "topology diagram",
  );
  const name = requiredText(payload.name ?? current.name, "name", 120);
  const nodes = normalizeDiagramNodes(payload.nodes, current.nodes || []);
  const nodeIds = new Set(nodes.map(({ id }) => id));
  const groups = normalizeDiagramGroups(payload.groups, current.groups || []);
  const groupIds = new Set(groups.map(({ id }) => id));
  const elements = normalizeDiagramElements(
    payload.elements,
    current.elements || [],
  );
  const elementIds = new Set(elements.map(({ id }) => id));
  groups.forEach(({ id }) => {
    if (!nodeIds.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `group must reference a node from the diagram: ${id}`,
      );
    }
  });
  elements.forEach(({ id }) => {
    if (!nodeIds.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `element must reference a node from the diagram: ${id}`,
      );
    }
    if (groupIds.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `node cannot be both a group and an element: ${id}`,
      );
    }
  });
  nodes.forEach(({ id, parentId }) => {
    if (parentId && !groupIds.has(parentId)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `node parent must reference a group from the diagram: ${parentId}`,
      );
    }
    if (parentId && groupIds.has(id)) {
      throw createCatalogError(
        422,
        "INVALID_TOPOLOGY_DIAGRAM",
        `groups cannot be nested: ${id}`,
      );
    }
  });
  return {
    name,
    normalizedName: normalizedName(name),
    environment: normalizeEnum(
      payload.environment,
      "environment",
      DEPLOYMENT_ENVIRONMENTS,
      current.environment || "production",
    ),
    nodes,
    groups,
    elements,
    edges: normalizeDiagramEdges(payload.edges, nodeIds, current.edges || []),
    comments:
      payload.comments === undefined
        ? current.comments || ""
        : optionalText(payload.comments, "comments", MAX_COMMENTS_LENGTH),
    hiddenIntegrationIds: normalizeDiagramVisibilityIds(
      payload.hiddenIntegrationIds,
      current.hiddenIntegrationIds || [],
      "hiddenIntegrationIds",
    ),
    hiddenServerIds: normalizeDiagramVisibilityIds(
      payload.hiddenServerIds,
      current.hiddenServerIds || [],
      "hiddenServerIds",
    ),
  };
}

export function summary(document) {
  return {
    id: document.id,
    name: document.name,
    environment: document.environment,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
  };
}

export function normalizeDiagram(document) {
  const normalized = normalizeDocument(document);
  if (!normalized) return null;
  const { normalizedName: _normalizedName, ...diagram } = normalized;
  return diagram;
}
