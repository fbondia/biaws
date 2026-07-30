import { randomUUID } from "node:crypto";

import { DEPLOYMENT_ENVIRONMENTS } from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import {
  actorId,
  assertAllowedFields,
  createCatalogError,
  duplicateKeyError,
  normalizeDocument,
  normalizeEnum,
  optionalText,
  pagination,
  requiredText,
  requireOperationalApplication,
} from "./topologyRepositorySupport.js";

export const TOPOLOGY_CONNECTION_TYPES = Object.freeze([
  "api",
  "database",
  "messaging",
  "cache",
  "file",
  "network",
  "dependency",
  "other",
]);
export const TOPOLOGY_CONNECTION_DIRECTIONS = Object.freeze([
  "none",
  "forward",
  "reverse",
  "both",
]);
export const TOPOLOGY_CONNECTION_LINE_TYPES = Object.freeze([
  "default",
  "smoothstep",
  "step",
  "straight",
]);
export const TOPOLOGY_CONNECTION_HANDLES = Object.freeze([
  "",
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
]);

const COLLECTION = COLLECTION_NAMES.APPLICATION_TOPOLOGY_DIAGRAMS;
const MAX_NODES = 250;
const MAX_EDGES = 500;
const MAX_COMMENTS_LENGTH = 20_000;
const MAX_LABEL_LENGTH = 200;
const MAX_NODE_ID_LENGTH = 150;
const MAX_VISIBILITY_IDS = 500;
const MAX_GROUPS = 50;
const MAX_ELEMENTS = 150;
const MAX_GROUP_DESCRIPTION_LENGTH = 2_000;
const MAX_COORDINATE = 1_000_000;
let indexesPromise;

function normalizedName(value) {
  return value.toLocaleLowerCase("pt-BR");
}

async function diagramsCollection() {
  const database = await getMongoDatabase();
  const collection = database.collection(COLLECTION);
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      collection.createIndex({ id: 1 }, { unique: true }),
      collection.createIndex(
        { workspaceId: 1, applicationId: 1, normalizedName: 1 },
        { unique: true },
      ),
      collection.createIndex({
        workspaceId: 1,
        applicationId: 1,
        updatedAt: -1,
        id: 1,
      }),
    ]).catch((error) => {
      indexesPromise = undefined;
      throw error;
    });
  }
  await indexesPromise;
  return collection;
}

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

function summary(document) {
  return {
    id: document.id,
    name: document.name,
    environment: document.environment,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
  };
}

function normalizeDiagram(document) {
  const normalized = normalizeDocument(document);
  if (!normalized) return null;
  const { normalizedName: _normalizedName, ...diagram } = normalized;
  return diagram;
}

export async function listTopologyDiagrams(applicationId, query = {}) {
  const application = await requireOperationalApplication(applicationId);
  const collection = await diagramsCollection();
  const { page, limit, skip } = pagination(query);
  const filter = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
  };
  const [documents, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ updatedAt: -1, name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map(summary),
  };
}

export async function getTopologyDiagram(
  diagramId,
  { applicationId, workspaceId } = {},
) {
  const collection = await diagramsCollection();
  const filter = { id: String(diagramId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const diagram = normalizeDiagram(await collection.findOne(filter));
  if (!diagram) return null;
  await requireOperationalApplication(diagram.applicationId, {
    workspaceId: diagram.workspaceId,
  });
  return diagram;
}

export async function createTopologyDiagram(
  applicationId,
  payload = {},
  actor = {},
) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const collection = await diagramsCollection();
  const value = normalizeDiagramPayload(payload);
  const now = new Date();
  const diagram = {
    id: randomUUID(),
    workspaceId: application.workspaceId,
    applicationId: application.id,
    ...value,
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
  try {
    await collection.insertOne(diagram);
  } catch (error) {
    duplicateKeyError(
      error,
      "TOPOLOGY_DIAGRAM_NAME_CONFLICT",
      "A topology diagram with this name already exists in the application",
    );
  }
  return normalizeDiagram(diagram);
}

export async function updateTopologyDiagram(
  diagramId,
  payload = {},
  actor = {},
) {
  const current = await getTopologyDiagram(diagramId);
  if (!current) {
    throw createCatalogError(
      404,
      "TOPOLOGY_DIAGRAM_NOT_FOUND",
      "Topology diagram not found",
    );
  }
  await requireOperationalApplication(current.applicationId, { active: true });
  const value = normalizeDiagramPayload(payload, current);
  const updatedAt = new Date();
  const collection = await diagramsCollection();
  try {
    await collection.updateOne(
      { id: current.id },
      {
        $set: {
          ...value,
          updatedAt,
          updatedBy: actorId(actor),
        },
      },
    );
  } catch (error) {
    duplicateKeyError(
      error,
      "TOPOLOGY_DIAGRAM_NAME_CONFLICT",
      "A topology diagram with this name already exists in the application",
    );
  }
  return getTopologyDiagram(current.id);
}
