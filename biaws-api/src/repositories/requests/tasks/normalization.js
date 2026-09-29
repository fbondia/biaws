import {
  readString,
  createHttpError,
  assertDate,
  dateInputValue,
} from "../support.js";
import {
  defaultTaskStatus,
  taskStatusOptions,
  allTaskStatusOptions,
} from "../options.js";
import { normalizeNoteDocument } from "../notes/normalization.js";

export function normalizeTaskPayload(
  payload = {},
  allowedHistoricalStatus = "",
) {
  const title = readString(payload.title).trim();
  const status =
    readString(payload.status, defaultTaskStatus).trim() || defaultTaskStatus;
  const startDate = readString(payload.startDate).trim();
  const endDate = readString(payload.endDate).trim();

  if (!title) {
    throw createHttpError(
      422,
      "Invalid request payload: task.title is required",
    );
  }
  if (
    !taskStatusOptions.includes(status) &&
    status !== allowedHistoricalStatus
  ) {
    throw createHttpError(
      422,
      `Invalid request payload: task.status must be one of ${taskStatusOptions.join(", ")}`,
    );
  }
  assertDate(startDate, "task.startDate");
  assertDate(endDate, "task.endDate");
  if (startDate && endDate && endDate < startDate) {
    throw createHttpError(
      422,
      "Invalid request payload: task.endDate must be on or after task.startDate",
    );
  }

  return {
    code: readString(payload.code).trim(),
    title,
    status,
    startDate,
    endDate,
    situation: readString(payload.situation),
    description: readString(payload.description),
    specification: readString(payload.specification),
  };
}

export function normalizeTaskDocument(document, context = {}) {
  return {
    id: document._id?.toString?.() ?? String(document._id),
    requestId:
      document.requestId?.toString?.() ?? String(document.requestId || ""),
    code: document.code || "",
    title: document.title || "",
    status: allTaskStatusOptions.includes(document.status)
      ? document.status
      : defaultTaskStatus,
    startDate: dateInputValue(document.startDate),
    endDate: dateInputValue(document.endDate),
    situation: document.situation || "",
    description: document.description || "",
    specification: document.specification || "",
    notes: Array.isArray(document.notes)
      ? document.notes.map(normalizeNoteDocument)
      : [],
    ...context,
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
  };
}
