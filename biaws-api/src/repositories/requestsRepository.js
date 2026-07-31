import { ObjectId } from "mongodb";

import {
  DEFAULT_REQUEST_STATUS,
  DEFAULT_REQUEST_TASK_STATUS,
  REQUEST_CHECKLIST_ITEMS,
  REQUEST_SPECIFICATION_SECTION_TITLES,
  REQUEST_STATUS_OPTIONS,
  REQUEST_TASK_STATUS_OPTIONS,
} from "../../../shared/requestConstants.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getPagination } from "../helpers/query.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import {
  activeValues,
  getRequestOptionLists,
} from "./optionListsRepository.js";
import {
  buildKnowledgeContextFilter,
  knowledgeContextWasProvided,
  normalizeStoredKnowledgeContext,
  resolveKnowledgeContext,
} from "./knowledgeContextRepository.js";

const REQUESTS_COLLECTION = COLLECTION_NAMES.REQUESTS;
const JOURNEY_PERIODS_COLLECTION = COLLECTION_NAMES.REQUEST_JOURNEY_PERIODS;
const SPECIFICATION_COLLECTION = COLLECTION_NAMES.REQUEST_SPECIFICATIONS;
const NOTES_COLLECTION = COLLECTION_NAMES.REQUEST_NOTES;
const TASKS_COLLECTION = COLLECTION_NAMES.REQUEST_TASKS;
const TASK_NOTES_COLLECTION = COLLECTION_NAMES.REQUEST_TASK_NOTES;
const LIST_RANK_STEP = 1000;

let requestStatusOptions = REQUEST_STATUS_OPTIONS;
let allRequestStatusOptions = REQUEST_STATUS_OPTIONS;
let defaultRequestStatus = DEFAULT_REQUEST_STATUS;
let taskStatusOptions = REQUEST_TASK_STATUS_OPTIONS;
let allTaskStatusOptions = REQUEST_TASK_STATUS_OPTIONS;
let defaultTaskStatus = DEFAULT_REQUEST_TASK_STATUS;
let checklistLabels = REQUEST_CHECKLIST_ITEMS;
let defaultSpecificationSectionTitles = REQUEST_SPECIFICATION_SECTION_TITLES;

async function loadRequestOptions(db, query = {}) {
  const lists = await getRequestOptionLists({
    db: db.databaseName,
    authorizationScope: query.authorizationScope,
    workspaceId: query.workspaceId,
  });
  requestStatusOptions = activeValues(lists.demandStatus);
  allRequestStatusOptions = (lists.demandStatus?.items || []).map(
    (item) => item.value,
  );
  defaultRequestStatus =
    lists.demandStatus?.defaultValue ||
    requestStatusOptions[0] ||
    DEFAULT_REQUEST_STATUS;
  taskStatusOptions = activeValues(lists.taskStatus);
  allTaskStatusOptions = (lists.taskStatus?.items || []).map(
    (item) => item.value,
  );
  defaultTaskStatus =
    lists.taskStatus?.defaultValue ||
    taskStatusOptions[0] ||
    DEFAULT_REQUEST_TASK_STATUS;
  checklistLabels = activeValues(lists.checklist);
  defaultSpecificationSectionTitles = activeValues(lists.specificationSections);
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isDateString(value) {
  return (
    typeof value === "string" && (!value || /^\d{4}-\d{2}-\d{2}$/u.test(value))
  );
}

function isMonthString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/u.test(value);
}

function readString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function readNumber(value, fieldName) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number) || number < 0) {
    throw createHttpError(
      422,
      `Invalid request payload: ${fieldName} must be a non-negative number`,
    );
  }

  return number;
}

function normalizeStatus(value, allowedHistoricalValue = "") {
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

function assertDate(value, fieldName) {
  if (!isDateString(value)) {
    throw createHttpError(
      422,
      `Invalid request payload: ${fieldName} must be YYYY-MM-DD`,
    );
  }
}

function dateInputValue(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value))
    return value.slice(0, 10);

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function todayInputValue() {
  return dateInputValue(new Date());
}

function padMonth(value) {
  return String(value).padStart(2, "0");
}

function monthKeysBetween(startDate, endDate) {
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

function normalizeChecklist(items = []) {
  const sourceItems = Array.isArray(items) ? items : [];
  const byLabel = new Map(sourceItems.map((item) => [item?.label, item]));
  const labels = [
    ...checklistLabels,
    ...sourceItems
      .map((item) => String(item?.label || "").trim())
      .filter(Boolean),
  ].filter((label, index, values) => values.indexOf(label) === index);

  return labels.map((label) => {
    const item = byLabel.get(label) || {};
    const date = readString(item.date);

    assertDate(date, `checklist.${label}.date`);

    return {
      label,
      done: Boolean(item.done),
      date,
      comment: readString(item.comment),
    };
  });
}

export function normalizeJourneyPeriods(
  payloadJourneyPeriods = [],
  startDate = "",
  endDate = "",
) {
  const journeysByMonth = new Map();

  if (Array.isArray(payloadJourneyPeriods)) {
    for (const [index, item] of payloadJourneyPeriods.entries()) {
      if (!isMonthString(item?.month)) {
        throw createHttpError(
          422,
          `Invalid request payload: journeys[${index}].month must be YYYY-MM`,
        );
      }

      const plannedJourneys = readNumber(
        item.plannedJourneys ?? item.predictedJourneys ?? item.journeys,
        `journeys[${index}].plannedJourneys`,
      );

      journeysByMonth.set(item.month, {
        plannedJourneys,
        executedJourneys: readNumber(
          item.executedJourneys ?? item.billedJourneys,
          `journeys[${index}].executedJourneys`,
        ),
        comment: readString(item.comment),
      });
    }
  }

  return monthKeysBetween(startDate, endDate).map((month) => {
    const current = journeysByMonth.get(month) || {};

    return {
      month,
      plannedJourneys: current.plannedJourneys || 0,
      executedJourneys: current.executedJourneys || 0,
      comment: current.comment || "",
    };
  });
}

function defaultSpecificationSections() {
  return defaultSpecificationSectionTitles.map((title, index) => ({
    id: `default-${index + 1}`,
    title,
    content: "",
    order: index,
  }));
}

function normalizeSpecification(payloadSpecification) {
  const payloadSections = Array.isArray(payloadSpecification)
    ? payloadSpecification
    : Array.isArray(payloadSpecification?.sections)
      ? payloadSpecification.sections
      : null;

  if (!payloadSections) {
    return {
      sections: defaultSpecificationSections(),
    };
  }

  return {
    sections: payloadSections
      .map((section, index) => ({
        id:
          readString(section?.id, `section-${index + 1}`).trim() ||
          `section-${index + 1}`,
        title: readString(section?.title, "Nova seção").trim() || "Nova seção",
        content: readString(section?.content),
        order: readNumber(
          section?.order ?? index,
          `specification.sections[${index}].order`,
        ),
      }))
      .sort((first, second) => first.order - second.order),
  };
}

function normalizeNotePayload(payload = {}, fallbackDate = todayInputValue()) {
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

function normalizeTaskPayload(payload = {}, allowedHistoricalStatus = "") {
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

function normalizeLegacyNotesPayload(value) {
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

function normalizeRequestPayload(payload = {}, allowedHistoricalStatus = "") {
  const title = readString(payload.title).trim();
  const estimatedDeliveryDate = readString(payload.estimatedDeliveryDate);
  const startDate = readString(payload.startDate);
  const endDate = readString(payload.endDate);

  assertDate(estimatedDeliveryDate, "estimatedDeliveryDate");
  assertDate(startDate, "startDate");
  assertDate(endDate, "endDate");

  return {
    request: {
      clientCode: readString(payload.clientCode).trim(),
      title,
      status: normalizeStatus(payload.status, allowedHistoricalStatus),
      estimatedDeliveryDate,
      startDate,
      endDate,
      estimatedJourneys: readNumber(
        payload.estimatedJourneys,
        "estimatedJourneys",
      ),
      description: readString(payload.description),
      checklist: normalizeChecklist(payload.checklist),
    },
    journeys: normalizeJourneyPeriods(
      payload.journeys ?? payload.billing,
      startDate,
      endDate,
    ),
    specification: normalizeSpecification(payload.specification),
  };
}

function dateRank(value) {
  const date = value instanceof Date ? value : new Date(value || 0);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function requestListRank(document) {
  const rank = Number(document?.listRank);
  return Number.isFinite(rank)
    ? rank
    : dateRank(document?.updatedAt || document?.createdAt);
}

function normalizeNoteDocument(document) {
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

function normalizeTaskDocument(document, context = {}) {
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

function normalizeRequestDocument(
  document,
  journeys = [],
  specification = null,
  notes = [],
  tasks = [],
) {
  if (!document) return null;
  const context = normalizeStoredKnowledgeContext(document);

  return {
    id: document._id?.toString?.() ?? String(document._id),
    clientCode: document.clientCode || "",
    title: document.title || "",
    status: allRequestStatusOptions.includes(document.status)
      ? document.status
      : defaultRequestStatus,
    estimatedDeliveryDate: document.estimatedDeliveryDate || "",
    startDate: document.startDate || "",
    endDate: document.endDate || "",
    estimatedJourneys: Number(document.estimatedJourneys) || 0,
    description: document.description || "",
    notes: notes.map(normalizeNoteDocument),
    tasks: tasks.map((task) => normalizeTaskDocument(task, context)),
    checklist: normalizeChecklist(document.checklist),
    journeys: normalizeJourneyPeriods(
      journeys,
      document.startDate || "",
      document.endDate || "",
    ),
    specification: normalizeSpecification(specification),
    attachments: Array.isArray(document.attachments)
      ? document.attachments
      : [],
    ...context,
    listRank: requestListRank(document),
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
  };
}

function requestObjectId(id) {
  if (!ObjectId.isValid(id)) {
    throw createHttpError(404, `Request not found: ${id}`);
  }

  return new ObjectId(id);
}

function requestNoteObjectId(id) {
  if (!ObjectId.isValid(id)) {
    throw createHttpError(404, `Request note not found: ${id}`);
  }

  return new ObjectId(id);
}

function requestTaskObjectId(id) {
  if (!ObjectId.isValid(id)) {
    throw createHttpError(404, `Request task not found: ${id}`);
  }

  return new ObjectId(id);
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection(REQUESTS_COLLECTION).createIndex({ updatedAt: -1 }),
    db
      .collection(REQUESTS_COLLECTION)
      .createIndex({ listRank: -1, updatedAt: -1, createdAt: -1 }),
    db.collection(REQUESTS_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      listRank: -1,
      updatedAt: -1,
      createdAt: -1,
    }),
    db.collection(REQUESTS_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      updatedAt: -1,
      _id: 1,
    }),
    db.collection(REQUESTS_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      affectedComponentIds: 1,
    }),
    db
      .collection(JOURNEY_PERIODS_COLLECTION)
      .createIndex({ requestId: 1, month: 1 }, { unique: true }),
    db
      .collection(SPECIFICATION_COLLECTION)
      .createIndex({ requestId: 1 }, { unique: true }),
    db
      .collection(NOTES_COLLECTION)
      .createIndex({ requestId: 1, date: -1, createdAt: -1 }),
    db
      .collection(TASKS_COLLECTION)
      .createIndex({ requestId: 1, createdAt: -1 }),
    db
      .collection(TASK_NOTES_COLLECTION)
      .createIndex({ requestId: 1, taskId: 1, date: -1, createdAt: -1 }),
    db.collection(NOTES_COLLECTION).createIndex(
      { requestId: 1, legacySource: 1 },
      {
        unique: true,
        partialFilterExpression: { legacySource: { $exists: true } },
      },
    ),
  ]);
}

async function ensureRequestListRanks(db) {
  const requestsWithoutRank = await db
    .collection(REQUESTS_COLLECTION)
    .find({ listRank: { $exists: false } })
    .project({ _id: 1, updatedAt: 1, createdAt: 1 })
    .toArray();

  if (!requestsWithoutRank.length) return;

  await db.collection(REQUESTS_COLLECTION).bulkWrite(
    requestsWithoutRank.map((request) => ({
      updateOne: {
        filter: { _id: request._id },
        update: {
          $set: {
            listRank: requestListRank(request),
          },
        },
      },
    })),
  );
}

async function nextTopListRank(db) {
  const topRequest = await db
    .collection(REQUESTS_COLLECTION)
    .find({})
    .sort({ listRank: -1, updatedAt: -1, createdAt: -1 })
    .project({ listRank: 1, updatedAt: 1, createdAt: 1 })
    .limit(1)
    .next();
  const topRank = requestListRank(topRequest);

  return Math.max(Date.now(), topRank + LIST_RANK_STEP);
}

async function readJourneyPeriods(db, requestIds) {
  if (!requestIds.length) return new Map();

  const rows = await db
    .collection(JOURNEY_PERIODS_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .sort({ month: 1 })
    .toArray();
  const byRequestId = new Map();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    const items = byRequestId.get(key) || [];
    items.push({
      month: row.month,
      plannedJourneys: Number(row.plannedJourneys ?? row.journeys) || 0,
      executedJourneys: Number(row.executedJourneys ?? row.billedJourneys) || 0,
      comment: row.comment || "",
    });
    byRequestId.set(key, items);
  }

  return byRequestId;
}

async function readSpecifications(db, requestIds) {
  if (!requestIds.length) return new Map();

  const rows = await db
    .collection(SPECIFICATION_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .toArray();
  const byRequestId = new Map();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    byRequestId.set(key, {
      sections: row.sections || [],
    });
  }

  return byRequestId;
}

async function readNotes(db, requestIds) {
  if (!requestIds.length) return new Map();

  const rows = await db
    .collection(NOTES_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .sort({ date: -1, createdAt: -1 })
    .toArray();
  const byRequestId = new Map();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    const items = byRequestId.get(key) || [];
    items.push(row);
    byRequestId.set(key, items);
  }

  return byRequestId;
}

async function readTasks(db, requestIds) {
  if (!requestIds.length) return new Map();

  const rows = await db
    .collection(TASKS_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .sort({ createdAt: -1 })
    .toArray();
  const taskIds = rows.map((row) => row._id);
  const noteRows = taskIds.length
    ? await db
        .collection(TASK_NOTES_COLLECTION)
        .find({ taskId: { $in: taskIds } })
        .sort({ date: -1, createdAt: -1 })
        .toArray()
    : [];
  const notesByTaskId = new Map();
  for (const note of noteRows) {
    const taskKey = note.taskId?.toString?.() ?? String(note.taskId);
    const notes = notesByTaskId.get(taskKey) || [];
    notes.push(note);
    notesByTaskId.set(taskKey, notes);
  }
  const byRequestId = new Map();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    const items = byRequestId.get(key) || [];
    items.push({ ...row, notes: notesByTaskId.get(row._id.toString()) || [] });
    byRequestId.set(key, items);
  }

  return byRequestId;
}

async function syncLegacyNotes(db, requestId, notes, now) {
  const notesCollection = db.collection(NOTES_COLLECTION);

  if (!notes || !notes.length) {
    await notesCollection.deleteMany({
      requestId,
      legacySource: "Request.notes",
    });
    return;
  }

  const [primaryNote] = notes;
  await notesCollection.updateOne(
    { requestId, legacySource: "Request.notes" },
    {
      $set: {
        requestId,
        legacySource: "Request.notes",
        date: primaryNote.date,
        content: primaryNote.content,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

async function insertInitialNotes(db, requestId, notes, now) {
  if (!notes || !notes.length) return;

  await db.collection(NOTES_COLLECTION).insertMany(
    notes.map((note) => ({
      requestId,
      date: note.date,
      content: note.content,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

async function migrateLegacyNotes(db, requests) {
  const requestsWithNotes = requests.filter((request) =>
    readString(request.notes).trim(),
  );
  if (!requestsWithNotes.length) return;

  const now = new Date();
  const requestIds = requestsWithNotes.map((request) => request._id);
  const existingNotes = await db
    .collection(NOTES_COLLECTION)
    .find({ requestId: { $in: requestIds }, legacySource: "Request.notes" })
    .toArray();
  const existingByRequestId = new Map(
    existingNotes.map((note) => [
      note.requestId?.toString?.() ?? String(note.requestId),
      note,
    ]),
  );
  const operations = [];

  for (const request of requestsWithNotes) {
    const requestIdKey = request._id.toString();
    const existingNote = existingByRequestId.get(requestIdKey);
    const nextNote = {
      requestId: request._id,
      legacySource: "Request.notes",
      date: dateInputValue(request.updatedAt || request.createdAt || now),
      content: readString(request.notes).trim(),
    };

    if (!existingNote) {
      operations.push({
        insertOne: {
          document: {
            ...nextNote,
            createdAt: now,
            updatedAt: now,
          },
        },
      });
      continue;
    }

    if (
      existingNote.date !== nextNote.date ||
      existingNote.content !== nextNote.content
    ) {
      operations.push({
        updateOne: {
          filter: { _id: existingNote._id },
          update: {
            $set: {
              date: nextNote.date,
              content: nextNote.content,
              updatedAt: now,
            },
          },
        },
      });
    }
  }

  if (operations.length) {
    await db.collection(NOTES_COLLECTION).bulkWrite(operations);
  }

  await db.collection(REQUESTS_COLLECTION).updateMany(
    { _id: { $in: requestIds } },
    {
      $unset: {
        notes: "",
      },
    },
  );
}

async function syncJourneyPeriods(db, requestId, journeys, now) {
  const journeyPeriodsCollection = db.collection(JOURNEY_PERIODS_COLLECTION);
  await journeyPeriodsCollection.deleteMany({ requestId });

  if (!journeys.length) return;

  await journeyPeriodsCollection.insertMany(
    journeys.map((item) => ({
      requestId,
      month: item.month,
      plannedJourneys: item.plannedJourneys,
      executedJourneys: item.executedJourneys,
      comment: item.comment || "",
      createdAt: now,
      updatedAt: now,
    })),
  );
}

async function syncSpecification(db, requestId, specification, now) {
  await db.collection(SPECIFICATION_COLLECTION).updateOne(
    { requestId },
    {
      $set: {
        requestId,
        sections: specification.sections.map((section, index) => ({
          id: section.id,
          title: section.title,
          content: section.content,
          order: index,
        })),
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

async function touchRequest(db, requestId, now) {
  await db.collection(REQUESTS_COLLECTION).updateOne(
    { _id: requestId },
    {
      $set: {
        updatedAt: now,
      },
    },
  );
}

function requestFilter(requestId, query = {}) {
  return { _id: requestId, ...buildKnowledgeContextFilter(query) };
}

async function ensureRequestExists(db, requestId, requestIdValue, query = {}) {
  const existing = await db
    .collection(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query), { projection: { _id: 1 } });

  if (!existing) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }
}

async function readRequestById(db, requestId, query = {}) {
  await loadRequestOptions(db, query);
  const request = await db
    .collection(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query));

  if (!request) return null;

  await migrateLegacyNotes(db, [request]);

  const [
    journeyPeriodsByRequestId,
    specificationByRequestId,
    notesByRequestId,
    tasksByRequestId,
  ] = await Promise.all([
    readJourneyPeriods(db, [requestId]),
    readSpecifications(db, [requestId]),
    readNotes(db, [requestId]),
    readTasks(db, [requestId]),
  ]);
  return normalizeRequestDocument(
    request,
    journeyPeriodsByRequestId.get(requestId.toString()) || [],
    specificationByRequestId.get(requestId.toString()),
    notesByRequestId.get(requestId.toString()) || [],
    tasksByRequestId.get(requestId.toString()) || [],
  );
}

export async function getRequest(requestIdValue, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const requestId = requestObjectId(requestIdValue);
  return { request: await readRequestById(db, requestId, query) };
}

export async function listRequests(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const filter = buildKnowledgeContextFilter(query);
  const requestedStatuses = String(query.status || "")
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  if (requestedStatuses.length) {
    const validStatuses = [...new Set(requestedStatuses)].filter((status) =>
      allRequestStatusOptions.includes(status),
    );
    filter.status =
      validStatuses.length === 1 ? validStatuses[0] : { $in: validStatuses };
  }
  const pagination = getPagination(query);
  const [requests, total] = await Promise.all([
    db
      .collection(REQUESTS_COLLECTION)
      .find(filter)
      .sort({ listRank: -1, updatedAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
    db.collection(REQUESTS_COLLECTION).countDocuments(filter),
  ]);
  await migrateLegacyNotes(db, requests);
  const requestIds = requests.map((request) => request._id);
  const [
    journeyPeriodsByRequestId,
    specificationByRequestId,
    notesByRequestId,
    tasksByRequestId,
  ] = await Promise.all([
    readJourneyPeriods(db, requestIds),
    readSpecifications(db, requestIds),
    readNotes(db, requestIds),
    readTasks(db, requestIds),
  ]);

  return {
    meta: {
      database: db.databaseName,
      collections: {
        requests: REQUESTS_COLLECTION,
        journeys: JOURNEY_PERIODS_COLLECTION,
        specifications: SPECIFICATION_COLLECTION,
        notes: NOTES_COLLECTION,
        tasks: TASKS_COLLECTION,
        taskNotes: TASK_NOTES_COLLECTION,
      },
      page: pagination.page,
      limit: pagination.limit,
      returned: requests.length,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      filter,
    },
    items: requests.map((request) =>
      normalizeRequestDocument(
        request,
        journeyPeriodsByRequestId.get(request._id.toString()) || [],
        specificationByRequestId.get(request._id.toString()),
        notesByRequestId.get(request._id.toString()) || [],
        tasksByRequestId.get(request._id.toString()) || [],
      ),
    ),
  };
}

export async function createRequest(payload, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const { request, journeys, specification } = normalizeRequestPayload(payload);
  const context = await resolveKnowledgeContext(db, payload, null, {
    applicationRequired: true,
    authorizationScope: query.authorizationScope,
    create: true,
  });
  const initialNotes = normalizeLegacyNotesPayload(payload.notes);
  const now = new Date();
  const result = await db.collection(REQUESTS_COLLECTION).insertOne({
    ...request,
    ...context,
    listRank: await nextTopListRank(db),
    createdAt: now,
    createdBy: payload.createdBy || "biaws-api",
    updatedAt: now,
    updatedBy: payload.createdBy || "biaws-api",
  });

  await syncJourneyPeriods(db, result.insertedId, journeys, now);
  await syncSpecification(db, result.insertedId, specification, now);
  await insertInitialNotes(db, result.insertedId, initialNotes, now);

  return {
    request: await readRequestById(db, result.insertedId, query),
  };
}

export async function updateRequest(requestIdValue, payload, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = requestObjectId(requestIdValue);
  const existing = await db
    .collection(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query));

  if (!existing) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }

  const [existingJourneyPeriodsByRequestId, existingSpecificationByRequestId] =
    await Promise.all([
      readJourneyPeriods(db, [requestId]),
      readSpecifications(db, [requestId]),
    ]);
  const existingJourneyPeriods =
    existingJourneyPeriodsByRequestId.get(requestId.toString()) || [];
  const existingSpecification = existingSpecificationByRequestId.get(
    requestId.toString(),
  );
  const { request, journeys, specification } = normalizeRequestPayload(
    {
      ...existing,
      ...payload,
      checklist: payload.checklist ?? existing.checklist,
      journeys: payload.journeys ?? payload.billing ?? existingJourneyPeriods,
      specification: payload.specification ?? existingSpecification,
    },
    existing.status,
  );
  if (knowledgeContextWasProvided(payload)) {
    Object.assign(
      request,
      await resolveKnowledgeContext(db, payload, existing, {
        applicationRequired: true,
        authorizationScope: query.authorizationScope,
      }),
    );
  }
  const now = new Date();

  await db
    .collection(REQUESTS_COLLECTION)
    .updateOne(requestFilter(requestId, query), {
      $set: {
        ...request,
        updatedAt: now,
        updatedBy: payload.updatedBy || "biaws-ui",
      },
      $unset: {
        notes: "",
      },
    });
  await syncJourneyPeriods(db, requestId, journeys, now);
  await syncSpecification(db, requestId, specification, now);
  if (typeof payload.notes === "string") {
    await syncLegacyNotes(
      db,
      requestId,
      normalizeLegacyNotesPayload(payload.notes),
      now,
    );
  }

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function createRequestNote(
  requestIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = requestObjectId(requestIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const note = normalizeNotePayload(payload);
  const now = new Date();

  await db.collection(NOTES_COLLECTION).insertOne({
    requestId,
    date: note.date,
    content: note.content,
    createdAt: now,
    updatedAt: now,
  });
  await touchRequest(db, requestId, now);

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function updateRequestNote(
  requestIdValue,
  noteIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = requestObjectId(requestIdValue);
  const noteId = requestNoteObjectId(noteIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const note = normalizeNotePayload(payload);
  const now = new Date();
  const result = await db.collection(NOTES_COLLECTION).updateOne(
    { _id: noteId, requestId },
    {
      $set: {
        date: note.date,
        content: note.content,
        updatedAt: now,
      },
    },
  );

  if (!result.matchedCount) {
    throw createHttpError(404, `Request note not found: ${noteIdValue}`);
  }

  await touchRequest(db, requestId, now);

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function deleteRequestNote(
  requestIdValue,
  noteIdValue,
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = requestObjectId(requestIdValue);
  const noteId = requestNoteObjectId(noteIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const note = await db
    .collection(NOTES_COLLECTION)
    .findOne({ _id: noteId, requestId }, { projection: { legacySource: 1 } });
  const result = await db
    .collection(NOTES_COLLECTION)
    .deleteOne({ _id: noteId, requestId });

  if (!result.deletedCount) {
    throw createHttpError(404, `Request note not found: ${noteIdValue}`);
  }

  const now = new Date();
  if (note?.legacySource === "Request.notes") {
    await db.collection(REQUESTS_COLLECTION).updateOne(
      { _id: requestId },
      {
        $unset: {
          notes: "",
        },
      },
    );
  }
  await touchRequest(db, requestId, now);

  return {
    deleted: true,
    request: await readRequestById(db, requestId, query),
  };
}

export async function createRequestTask(
  requestIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);

  const requestId = requestObjectId(requestIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const task = normalizeTaskPayload(payload);
  const now = new Date();
  await db.collection(TASKS_COLLECTION).insertOne({
    requestId,
    ...task,
    createdAt: now,
    updatedAt: now,
  });
  await touchRequest(db, requestId, now);

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function updateRequestTask(
  requestIdValue,
  taskIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);

  const requestId = requestObjectId(requestIdValue);
  const taskId = requestTaskObjectId(taskIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const existing = await db
    .collection(TASKS_COLLECTION)
    .findOne({ _id: taskId, requestId });
  if (!existing) {
    throw createHttpError(404, `Request task not found: ${taskIdValue}`);
  }

  const task = normalizeTaskPayload(
    { ...existing, ...payload },
    existing.status,
  );
  const now = new Date();
  await db.collection(TASKS_COLLECTION).updateOne(
    { _id: taskId, requestId },
    {
      $set: {
        ...task,
        updatedAt: now,
      },
    },
  );
  const previousCode = String(existing.code || "")
    .trim()
    .toLowerCase();
  const nextCode = String(task.code || "")
    .trim()
    .toLowerCase();
  if (previousCode && previousCode !== nextCode) {
    const request = await db
      .collection(REQUESTS_COLLECTION)
      .findOne({ _id: requestId }, { projection: { attachments: 1 } });
    const attachments = (request?.attachments || []).map((attachment) => ({
      ...attachment,
      tags: [
        ...new Set(
          (attachment.tags || []).map((tag) =>
            String(tag).trim().toLowerCase() === previousCode ? nextCode : tag,
          ),
        ),
      ].filter(Boolean),
    }));
    await db
      .collection(REQUESTS_COLLECTION)
      .updateOne({ _id: requestId }, { $set: { attachments } });
  }
  await touchRequest(db, requestId, now);

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function deleteRequestTask(
  requestIdValue,
  taskIdValue,
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = requestObjectId(requestIdValue);
  const taskId = requestTaskObjectId(taskIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const result = await db
    .collection(TASKS_COLLECTION)
    .deleteOne({ _id: taskId, requestId });
  if (!result.deletedCount) {
    throw createHttpError(404, `Request task not found: ${taskIdValue}`);
  }

  await db.collection(TASK_NOTES_COLLECTION).deleteMany({ requestId, taskId });

  const now = new Date();
  await touchRequest(db, requestId, now);

  return {
    deleted: true,
    request: await readRequestById(db, requestId, query),
  };
}

export async function createRequestTaskNote(
  requestIdValue,
  taskIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = requestObjectId(requestIdValue);
  const taskId = requestTaskObjectId(taskIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);
  const task = await db
    .collection(TASKS_COLLECTION)
    .findOne({ _id: taskId, requestId }, { projection: { _id: 1 } });
  if (!task)
    throw createHttpError(404, `Request task not found: ${taskIdValue}`);

  const note = normalizeNotePayload(payload);
  const now = new Date();
  await db.collection(TASK_NOTES_COLLECTION).insertOne({
    requestId,
    taskId,
    date: note.date,
    content: note.content,
    createdAt: now,
    updatedAt: now,
  });
  await touchRequest(db, requestId, now);

  return { request: await readRequestById(db, requestId, query) };
}

export async function updateRequestTaskNote(
  requestIdValue,
  taskIdValue,
  noteIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = requestObjectId(requestIdValue);
  const taskId = requestTaskObjectId(taskIdValue);
  const noteId = requestNoteObjectId(noteIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);
  const note = normalizeNotePayload(payload);
  const now = new Date();
  const result = await db
    .collection(TASK_NOTES_COLLECTION)
    .updateOne(
      { _id: noteId, requestId, taskId },
      { $set: { date: note.date, content: note.content, updatedAt: now } },
    );
  if (!result.matchedCount)
    throw createHttpError(404, `Request task note not found: ${noteIdValue}`);
  await touchRequest(db, requestId, now);

  return { request: await readRequestById(db, requestId, query) };
}

export async function deleteRequestTaskNote(
  requestIdValue,
  taskIdValue,
  noteIdValue,
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = requestObjectId(requestIdValue);
  const taskId = requestTaskObjectId(taskIdValue);
  const noteId = requestNoteObjectId(noteIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);
  const result = await db
    .collection(TASK_NOTES_COLLECTION)
    .deleteOne({ _id: noteId, requestId, taskId });
  if (!result.deletedCount)
    throw createHttpError(404, `Request task note not found: ${noteIdValue}`);
  const now = new Date();
  await touchRequest(db, requestId, now);

  return {
    deleted: true,
    request: await readRequestById(db, requestId, query),
  };
}

async function readListRankNeighbor(db, requestIdValue, fieldName, query = {}) {
  if (!requestIdValue) return null;

  const requestId = requestObjectId(requestIdValue);
  const request = await db
    .collection(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query), {
      projection: { listRank: 1, updatedAt: 1, createdAt: 1 },
    });

  if (!request) {
    throw createHttpError(
      422,
      `Invalid request payload: ${fieldName} request not found`,
    );
  }

  return requestListRank(request);
}

function calculateMovedListRank(previousRank, nextRank) {
  if (Number.isFinite(previousRank) && Number.isFinite(nextRank)) {
    if (previousRank > nextRank) return (previousRank + nextRank) / 2;
    return previousRank + LIST_RANK_STEP;
  }

  if (Number.isFinite(nextRank)) return nextRank + LIST_RANK_STEP;
  if (Number.isFinite(previousRank)) return previousRank - LIST_RANK_STEP;

  return Date.now();
}

export async function reorderRequest(requestIdValue, payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = requestObjectId(requestIdValue);
  const existing = await db
    .collection(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query));

  if (!existing) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }

  const previousRank = await readListRankNeighbor(
    db,
    payload.previousRequestId,
    "previousRequestId",
    query,
  );
  const nextRank = await readListRankNeighbor(
    db,
    payload.nextRequestId,
    "nextRequestId",
    query,
  );
  const listRank = calculateMovedListRank(previousRank, nextRank);

  await db
    .collection(REQUESTS_COLLECTION)
    .updateOne(requestFilter(requestId, query), {
      $set: {
        listRank,
      },
    });

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function deleteRequest(requestIdValue, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = requestObjectId(requestIdValue);
  const deleteResult = await db
    .collection(REQUESTS_COLLECTION)
    .deleteOne(requestFilter(requestId, query));

  if (!deleteResult.deletedCount) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }

  await db.collection(JOURNEY_PERIODS_COLLECTION).deleteMany({ requestId });
  await db.collection(SPECIFICATION_COLLECTION).deleteMany({ requestId });
  await db.collection(NOTES_COLLECTION).deleteMany({ requestId });
  await db.collection(TASKS_COLLECTION).deleteMany({ requestId });
  await db.collection(TASK_NOTES_COLLECTION).deleteMany({ requestId });

  return {
    deleted: true,
    id: requestIdValue,
  };
}
