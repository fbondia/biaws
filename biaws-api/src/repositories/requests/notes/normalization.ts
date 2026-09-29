import type { NoteDocument } from "../../../types/requests.js";
import {
  todayInputValue,
  readString,
  assertDate,
  createHttpError,
  dateInputValue,
} from "../support.js";

export function normalizeNotePayload(
  payload: Record<string, unknown> = {},
  fallbackDate = todayInputValue(),
) {
  const date = readString(payload.date, fallbackDate).trim() || fallbackDate;
  const content = readString(
    payload.content ?? payload.notes ?? payload.note,
  ).trim();

  assertDate(date, "notes.date");

  if (!content) {
    throw createHttpError(
      422,
      "Invalid request payload: notes.content is required",
    );
  }

  return {
    date,
    content,
  };
}

export function normalizeLegacyNotesPayload(value: unknown) {
  if (value === undefined) return null;

  if (Array.isArray(value)) {
    return value
      .filter(
        (note) =>
          note && readString(note.content ?? note.notes ?? note.note).trim(),
      )
      .map((note) => normalizeNotePayload(note));
  }

  const content = readString(value).trim();
  if (!content) return [];

  return [
    {
      date: todayInputValue(),
      content,
    },
  ];
}

export function normalizeNoteDocument(document: NoteDocument) {
  return {
    id: document._id?.toString?.() ?? String(document._id),
    requestId:
      document.requestId?.toString?.() ?? String(document.requestId || ""),
    date: dateInputValue(document.date || document.createdAt),
    content: document.content || "",
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
  };
}
