export {
  TOPOLOGY_CONNECTION_TYPES,
  TOPOLOGY_CONNECTION_DIRECTIONS,
  TOPOLOGY_CONNECTION_LINE_TYPES,
  TOPOLOGY_CONNECTION_HANDLES,
} from "./constants.js";

export {
  normalizeDiagramNodes,
  normalizeDiagramEdges,
  normalizeDiagramVisibilityIds,
  normalizeDiagramGroups,
  normalizeDiagramElements,
  normalizeDiagramPayload,
} from "./normalization.js";

export { listTopologyDiagrams, getTopologyDiagram } from "./queries.js";

export { createTopologyDiagram, updateTopologyDiagram } from "./mutations.js";
