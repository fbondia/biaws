import { DEPLOYMENT_STATUSES, RUNTIME_STATUSES } from "../../../../shared/index.js";

export const MUTABLE_DEPLOYMENT_STATUSES = DEPLOYMENT_STATUSES.filter((status) => status !== "archived");

export const MUTABLE_RUNTIME_STATUSES = RUNTIME_STATUSES.filter((status) => status !== "archived");

export const MAX_HISTORY_ITEMS = 200;

export const MAX_OPERATIONAL_NOTES_LENGTH = 20_000;

export const MAX_RUNTIME_DOCUMENTS = 100;

export const RUNTIME_DOCUMENT_PURPOSES = Object.freeze([
  "operation",
  "deployment",
  "rollback",
  "troubleshooting",
  "monitoring",
  "reference",
]);
