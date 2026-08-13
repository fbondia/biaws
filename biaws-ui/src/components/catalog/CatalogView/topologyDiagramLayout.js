const GROUP_MIN_WIDTH = 640;
const GROUP_MIN_HEIGHT = 380;
const GROUP_CHILD_WIDTH = 320;
const GROUP_CHILD_HEIGHT = 260;
const DEFAULT_NODE_WIDTH = 285;
const DEFAULT_NODE_HEIGHT = 100;
const DIRECTION_SECTOR_SIZE = Math.PI / 4;
const TOPOLOGY_HANDLE_PAIRS = Object.freeze([
  ["right", "left"],
  ["bottom-right", "top-left"],
  ["bottom", "top"],
  ["bottom-left", "top-right"],
  ["left", "right"],
  ["top-left", "bottom-right"],
  ["top", "bottom"],
  ["top-right", "bottom-left"],
]);

function numericDimension(value) {
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nodeCenter(node, nodesById, resolving = new Set()) {
  if (!node || resolving.has(node.id)) return null;
  resolving.add(node.id);

  let x = node.position?.x || 0;
  let y = node.position?.y || 0;
  if (node.parentId) {
    const parentCenter = nodeCenter(
      nodesById.get(node.parentId),
      nodesById,
      resolving,
    );
    const parent = nodesById.get(node.parentId);
    const parentWidth =
      numericDimension(parent?.measured?.width) ||
      numericDimension(parent?.width) ||
      numericDimension(parent?.style?.width) ||
      DEFAULT_NODE_WIDTH;
    const parentHeight =
      numericDimension(parent?.measured?.height) ||
      numericDimension(parent?.height) ||
      numericDimension(parent?.style?.height) ||
      DEFAULT_NODE_HEIGHT;
    if (parentCenter) {
      x += parentCenter.x - parentWidth / 2;
      y += parentCenter.y - parentHeight / 2;
    }
  }

  resolving.delete(node.id);
  const width =
    numericDimension(node.measured?.width) ||
    numericDimension(node.width) ||
    numericDimension(node.style?.width) ||
    DEFAULT_NODE_WIDTH;
  const height =
    numericDimension(node.measured?.height) ||
    numericDimension(node.height) ||
    numericDimension(node.style?.height) ||
    DEFAULT_NODE_HEIGHT;
  return { x: x + width / 2, y: y + height / 2 };
}

export function automaticTopologyHandles(nodes, sourceId, targetId) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const sourceCenter = nodeCenter(nodesById.get(sourceId), nodesById);
  const targetCenter = nodeCenter(nodesById.get(targetId), nodesById);
  if (!sourceCenter || !targetCenter) return {};

  const angle = Math.atan2(
    targetCenter.y - sourceCenter.y,
    targetCenter.x - sourceCenter.x,
  );
  const sector =
    Math.round(angle / DIRECTION_SECTOR_SIZE) % TOPOLOGY_HANDLE_PAIRS.length;
  const [sourceHandle, targetHandle] =
    TOPOLOGY_HANDLE_PAIRS[
      (sector + TOPOLOGY_HANDLE_PAIRS.length) % TOPOLOGY_HANDLE_PAIRS.length
    ];
  return { sourceHandle, targetHandle };
}

export function routeTopologyEdges(nodes, edges) {
  return edges.map((edge) => ({
    ...edge,
    ...automaticTopologyHandles(nodes, edge.source, edge.target),
  }));
}

export function resizeTopologyGroups(nodes = []) {
  return nodes.map((node) => {
    if (node.type !== "topologyGroup") return node;
    const children = nodes.filter(({ parentId }) => parentId === node.id);
    return {
      ...node,
      style: {
        ...node.style,
        width: Math.max(
          GROUP_MIN_WIDTH,
          ...children.map(({ position }) => position.x + GROUP_CHILD_WIDTH),
        ),
        height: Math.max(
          GROUP_MIN_HEIGHT,
          ...children.map(({ position }) => position.y + GROUP_CHILD_HEIGHT),
        ),
      },
    };
  });
}
