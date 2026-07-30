import {
  REQUEST_ALL_STATUS_OPTIONS,
  REQUEST_DEFAULTS,
  REQUEST_STATUS_COLORS,
  requestOptionLabel,
} from "../../../data/requestConstants.js";

const DEFAULT_STATUS_COLORS = {
  foreground: "#475467",
  background: "#f2f4f7",
  border: "#d0d5dd",
};

export function normalizeRequestStatus(status) {
  return REQUEST_ALL_STATUS_OPTIONS.includes(status)
    ? status
    : REQUEST_DEFAULTS.status;
}

export function requestStatusLabel(status) {
  return requestOptionLabel("demand.status", status);
}

export function requestTaskStatusLabel(status) {
  return requestOptionLabel("demand.task-status", status);
}

export function requestChecklistLabel(value) {
  return requestOptionLabel("demand.checklist", value);
}

function requestStatusColors(status) {
  const normalizedStatus = normalizeRequestStatus(status);
  return (
    REQUEST_STATUS_COLORS[normalizedStatus] ||
    REQUEST_STATUS_COLORS[REQUEST_DEFAULTS.status] ||
    DEFAULT_STATUS_COLORS
  );
}

export function requestStatusStyle(status) {
  const colors = requestStatusColors(status);
  return {
    "--request-status-foreground":
      colors.foreground || DEFAULT_STATUS_COLORS.foreground,
    "--request-status-background":
      colors.background || DEFAULT_STATUS_COLORS.background,
    "--request-status-border": colors.border || DEFAULT_STATUS_COLORS.border,
  };
}

export function requestGanttStatusStyle(status) {
  const colors = requestStatusColors(status);
  return {
    backgroundColor: colors.foreground || DEFAULT_STATUS_COLORS.foreground,
    borderColor: colors.border || DEFAULT_STATUS_COLORS.border,
  };
}
