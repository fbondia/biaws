import { COLLECTION_NAMES } from "../../database/collectionNames.js";

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

export const COLLECTION = COLLECTION_NAMES.APPLICATION_TOPOLOGY_DIAGRAMS;

export const MAX_NODES = 250;

export const MAX_EDGES = 500;

export const MAX_COMMENTS_LENGTH = 20_000;

export const MAX_LABEL_LENGTH = 200;

export const MAX_NODE_ID_LENGTH = 150;

export const MAX_VISIBILITY_IDS = 500;

export const MAX_GROUPS = 50;

export const MAX_ELEMENTS = 150;

export const MAX_GROUP_DESCRIPTION_LENGTH = 2_000;

export const MAX_COORDINATE = 1_000_000;
