import { defaultRequestStatus, requestStatusOptions } from "./options.js";

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isDateString(value) {
  return (
    typeof value === "string" && (!value || /^\d{4}-\d{2}-\d{2}$/u.test(value))
  );
}

export function isMonthString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/u.test(value);
}

export function readString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

export function readNumber(value, fieldName) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number) || number < 0) {
    throw createHttpError(
      422,
      `Invalid request payload: ${fieldName} must be a non-negative number`,
    );
  }

  return number;
}

export function normalizeStatus(value, allowedHistoricalValue = "") {
  const status =
    readString(value, defaultRequestStatus).trim() || defaultRequestStatus;

  if (
    !requestStatusOptions.includes(status) &&
    status !== allowedHistoricalValue
  ) {
    throw createHttpError(
      422,
      `Invalid request payload: status must be one of ${requestStatusOptions.join(", ")}`,
    );
  }

  return status;
}

export function assertDate(value, fieldName) {
  if (!isDateString(value)) {
    throw createHttpError(
      422,
      `Invalid request payload: ${fieldName} must be YYYY-MM-DD`,
    );
  }
}

export function dateInputValue(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value))
    return value.slice(0, 10);

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

export function todayInputValue() {
  return dateInputValue(new Date());
}

function padMonth(value) {
  return String(value).padStart(2, "0");
}

export function monthKeysBetween(startDate, endDate) {
  const start = new Date(`${startDate || ""}T00:00:00Z`);
  const end = new Date(`${endDate || ""}T00:00:00Z`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return [];
  }

  const months = [];
  let cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
  );
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= limit) {
    months.push(
      `${cursor.getUTCFullYear()}-${padMonth(cursor.getUTCMonth() + 1)}`,
    );
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  return months;
}
