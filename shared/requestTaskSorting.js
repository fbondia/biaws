import { REQUEST_TASK_STATUS_OPTIONS } from "./requestConstants.js";

const NATURAL_IDENTIFIER_OPTIONS = {
  numeric: true,
  sensitivity: "base",
};

function statusSortValue(status, statusOptions) {
  const index = statusOptions.indexOf(status);
  return index === -1 ? statusOptions.length : index;
}

function taskIdentifier(task) {
  return String(task?.code || task?.id || task?._id || "").trim();
}

function createdAtSortValue(task) {
  if (!task?.createdAt) return Number.NEGATIVE_INFINITY;

  const timestamp = new Date(task.createdAt).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function compareRequestTasks(
  first,
  second,
  statusOptions = REQUEST_TASK_STATUS_OPTIONS,
) {
  const firstStatusOrder = statusSortValue(first?.status, statusOptions);
  const secondStatusOrder = statusSortValue(second?.status, statusOptions);
  if (firstStatusOrder !== secondStatusOrder) {
    return firstStatusOrder - secondStatusOrder;
  }

  if (
    firstStatusOrder === statusOptions.length &&
    first?.status !== second?.status
  ) {
    const statusComparison = String(first?.status || "").localeCompare(
      String(second?.status || ""),
      "pt-BR",
      NATURAL_IDENTIFIER_OPTIONS,
    );
    if (statusComparison) return statusComparison;
  }

  const identifierComparison = taskIdentifier(first).localeCompare(
    taskIdentifier(second),
    "pt-BR",
    NATURAL_IDENTIFIER_OPTIONS,
  );
  if (identifierComparison) return identifierComparison;

  return createdAtSortValue(second) - createdAtSortValue(first);
}
