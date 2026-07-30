import { buildKnowledgeContextFilter } from "../repositories/knowledgeContextRepository.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_DATE_FIELD = "receivedEmailAt";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const DATE_INTERVALS = new Set(["day", "week", "month", "year"]);

const DATE_FIELDS = new Set([
  "receivedEmailAt",
  "issueCreatedAt",
  "firstThreadEmailAt",
  "closedAt",
  "updatedAt",
]);

const SORT_FIELDS = new Set([
  "date",
  "id",
  "type",
  "status",
  "title",
  "updatedAt",
  "receivedEmailAt",
  "issueCreatedAt",
  "firstThreadEmailAt",
  "closedAt",
]);

function queryError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  error.code = "INVALID_QUERY";
  return error;
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function readString(query, ...keys) {
  for (const key of keys) {
    const value = firstValue(query[key]);
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function readList(query, ...keys) {
  const rawValue = readString(query, ...keys);
  if (!rawValue) return [];

  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readTagFilters(query = {}) {
  return Object.entries(query).flatMap(([key, value]) => {
    const tagPrefix = "tag_";
    const dottedPrefix = "tags.";
    const groupId = key.startsWith(tagPrefix)
      ? key.slice(tagPrefix.length)
      : key.startsWith(dottedPrefix)
        ? key.slice(dottedPrefix.length)
        : "";

    if (!groupId) return [];

    const values = readList({ value }, "value");
    return values.length ? [{ groupId, values }] : [];
  });
}

function readPositiveInteger(query, key, fallback, max) {
  const rawValue = readString(query, key);
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw queryError(`${key} must be a positive integer.`);
  }
  if (value > max) return max;
  return value;
}

function parseDate(value, bound) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return undefined;

  const normalized =
    /^\d{4}-\d{2}-\d{2}$/u.test(rawValue) && bound === "end"
      ? `${rawValue}T23:59:59.999Z`
      : /^\d{4}-\d{2}-\d{2}$/u.test(rawValue)
        ? `${rawValue}T00:00:00.000Z`
        : rawValue;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw queryError(`Invalid date: ${value}`);
  }

  return date;
}

export function resolveDateField(query = {}) {
  const dateField = readString(query, "dateField") || DEFAULT_DATE_FIELD;
  if (!DATE_FIELDS.has(dateField)) {
    throw queryError(
      `dateField must be one of: ${Array.from(DATE_FIELDS).join(", ")}.`,
    );
  }
  return dateField;
}

export function getDatePath(dateField) {
  return dateField === "updatedAt" ? "updatedAt" : `dates.${dateField}`;
}

export function getPagination(query = {}) {
  const page = readPositiveInteger(query, "page", DEFAULT_PAGE, 100000);
  const limit = readPositiveInteger(query, "limit", DEFAULT_LIMIT, MAX_LIMIT);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function addRegexFilter(target, field, value) {
  if (!value) return;
  target.push({
    [field]: {
      $regex: escapeRegex(value),
      $options: "i",
    },
  });
}

function addListFilter(filter, field, values) {
  if (values.length === 1) filter[field] = values[0];
  if (values.length > 1) filter[field] = { $in: values };
}

function addDateFilter(filter, path, fromDate, toDate) {
  if (!fromDate && !toDate) return;
  filter[path] = {};
  if (fromDate) filter[path].$gte = fromDate;
  if (toDate) filter[path].$lte = toDate;
}

function addTaxonomyFilter(and, taxonomyIds) {
  if (!taxonomyIds.length) return;
  and.push({
    $or: [
      { "classification.primaryTaxonomyId": { $in: taxonomyIds } },
      { "classification.secondaryTaxonomyIds": { $in: taxonomyIds } },
    ],
  });
}

function addTextFilter(and, text) {
  if (!text) return;
  const regex = {
    $regex: escapeRegex(text),
    $options: "i",
  };
  and.push({
    $or: [
      { id: regex },
      { title: regex },
      { text: regex },
      { "source.file": regex },
      { "source.messageId": regex },
      { "attachments.filename": regex },
    ],
  });
}

export function buildIssueFilter(query = {}, options = {}) {
  const and = [];
  const filter = buildKnowledgeContextFilter(query);
  const issueCode = readString(query, "codigo", "code", "id");
  const title = readString(query, "title");
  const text = readString(query, "texto", "text", "q");
  const types = readList(query, "tipo", "type");
  const statuses = readList(query, "status");
  const taxonomyIds =
    options.taxonomyIds || readList(query, "taxonomy", "taxonomyIds");
  const dateField = resolveDateField(query);
  const datePath = getDatePath(dateField);
  const fromDate = parseDate(readString(query, "from", "dateFrom"), "start");
  const toDate = parseDate(readString(query, "to", "dateTo"), "end");
  const tagFilters = readTagFilters(query);

  addRegexFilter(and, "id", issueCode);
  addRegexFilter(and, "title", title);
  addListFilter(filter, "type", types);
  addListFilter(filter, "status", statuses);
  addDateFilter(filter, datePath, fromDate, toDate);

  for (const tagFilter of tagFilters) {
    filter[`classification.tags.${tagFilter.groupId}`] =
      tagFilter.values.length === 1
        ? tagFilter.values[0]
        : { $in: tagFilter.values };
  }
  addTaxonomyFilter(and, taxonomyIds);
  addTextFilter(and, text);

  if (and.length === 1) {
    Object.assign(filter, and[0]);
  } else if (and.length > 1) {
    filter.$and = and;
  }

  return filter;
}

function sortFieldToPath(sortField, dateField) {
  if (sortField === "date") return getDatePath(dateField);
  if (DATE_FIELDS.has(sortField)) return getDatePath(sortField);
  return sortField;
}

export function buildIssueSort(query = {}) {
  const dateField = resolveDateField(query);
  const order = readString(query, "order").toLowerCase();
  const rawSort = readString(query, "sort") || "-date";
  const isDescendingPrefix = rawSort.startsWith("-");
  const sortField = isDescendingPrefix ? rawSort.slice(1) : rawSort;

  if (!SORT_FIELDS.has(sortField)) {
    throw queryError(
      `sort must be one of: ${Array.from(SORT_FIELDS).join(", ")}.`,
    );
  }

  const direction =
    order === "asc" ? 1 : order === "desc" ? -1 : isDescendingPrefix ? -1 : 1;
  const sortPath = sortFieldToPath(sortField, dateField);

  return {
    [sortPath]: direction,
    _id: direction,
  };
}

function resolveDateInterval(query = {}, forcedInterval) {
  const rawInterval = forcedInterval || readString(query, "interval") || "day";

  if (!DATE_INTERVALS.has(rawInterval)) {
    throw queryError(
      `interval must be one of: ${Array.from(DATE_INTERVALS).join(", ")}.`,
    );
  }

  return rawInterval;
}

function getDateFormat(interval) {
  if (interval === "year") return "%Y";
  if (interval === "month") return "%Y-%m";
  return "%Y-%m-%d";
}

export function getSummaryOptions(query = {}, forcedInterval) {
  const dateField = resolveDateField(query);
  const interval = resolveDateInterval(query, forcedInterval);
  const timezone = readString(query, "timezone") || DEFAULT_TIMEZONE;

  return {
    dateField,
    datePath: getDatePath(dateField),
    interval,
    dateFormat: getDateFormat(interval),
    timezone,
  };
}

export function readAggregateGroup(query = {}) {
  const groupBy = readString(query, "groupBy") || "date";
  if (
    ![
      "date",
      "day",
      "week",
      "month",
      "year",
      "type",
      "status",
      "taxonomy",
    ].includes(groupBy)
  ) {
    throw queryError(
      "groupBy must be date, day, week, month, year, type, status, or taxonomy.",
    );
  }
  return groupBy;
}
