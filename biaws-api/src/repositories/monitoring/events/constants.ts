import { RUNTIME_STATUSES } from "../../../../../shared/index.js";

export const SIGNAL_STATUSES = RUNTIME_STATUSES.filter((status) => status !== "archived");

export const SIGNAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export const PAYLOAD_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;

export const PROHIBITED_PAYLOAD_KEY =
  /(?:password|passwd|pwd|secret|token|credential|authorization|api[-_.]?key|private[-_.]?key|kubeconfig|connection[-_.]?string)/iu;

export const PAYLOAD_LIMITS = Object.freeze({
  arrayItems: 100,
  bytes: 65_536,
  depth: 8,
  nodes: 1_000,
  string: 8_000,
});

export const DAY_MS = 86_400_000;
