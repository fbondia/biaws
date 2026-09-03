import {
  cleanParams,
  deleteJson,
  fetchJson,
  sendJson,
} from "../../httpClient.js";

// A API fornece as opções em runtime; estes valores preservam compatibilidade
// somente quando uma instalação antiga ainda não publicou as listas.
const DEFAULT_REQUEST_STATUS = "Sugerido";
const DEFAULT_REQUEST_TASK_STATUS = "Pendente";

async function requestOptions() {
  const payload = await fetchJson("/api/option-lists/runtime");
  const byKey = Object.fromEntries(
    (payload.items || []).map((list) => [list.key, list]),
  );
  const read = (key, fallback) => {
    const list = byKey[key];
    return {
      values: (list?.items || [])
        .filter((item) => item.active !== false)
        .map((item) => item.value),
      defaultValue: list?.defaultValue || fallback,
    };
  };
  return {
    demandStatus: read("demand.status", DEFAULT_REQUEST_STATUS),
    taskStatus: read("demand.task-status", DEFAULT_REQUEST_TASK_STATUS),
  };
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function todayLabel() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
}

function filterDemands(items, args = {}) {
  const status = String(args.status || "").trim();
  const code = normalizeText(args.code);
  const text = normalizeText(args.text);

  return items.filter((request) => {
    if (status && request.status !== status) return false;
    if (code && !normalizeText(request.clientCode).includes(code)) return false;
    if (text) {
      const haystack = normalizeText(
        [
          request.clientCode,
          request.title,
          request.description,
          request.specification?.sections
            ?.map((section) => `${section.title} ${section.content}`)
            .join(" "),
        ].join(" "),
      );
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}

function compactDemand(request) {
  return {
    id: request.id,
    clientCode: request.clientCode,
    title: request.title,
    status: request.status,
    description: request.description,
    estimatedDeliveryDate: request.estimatedDeliveryDate,
    startDate: request.startDate,
    endDate: request.endDate,
    estimatedJourneys: request.estimatedJourneys,
    collectionId: request.collectionId || "",
    listRank: request.listRank,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    workspaceId: request.workspaceId,
    applicationId: request.applicationId,
    affectedComponentIds: request.affectedComponentIds || [],
  };
}

async function readAllDemands(args = {}) {
  return fetchJson(
    "/api/requests",
    cleanParams({
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      componentId: args.componentId,
    }),
  );
}

async function readDemand(requestId) {
  const payload = await readAllDemands();
  const request = payload.items.find(
    (item) => item.id === requestId || item.clientCode === requestId,
  );
  if (!request) throw new Error(`Demand not found: ${requestId}`);
  return {
    meta: payload.meta,
    request,
  };
}

function journeySummaryForRequest(request) {
  const plannedJourneys = request.journeys.reduce(
    (total, item) => total + (Number(item.plannedJourneys) || 0),
    0,
  );
  const executedJourneys = request.journeys.reduce(
    (total, item) => total + (Number(item.executedJourneys) || 0),
    0,
  );

  return {
    plannedJourneys,
    executedJourneys,
    pendingJourneys: Math.max(0, plannedJourneys - executedJourneys),
    months: request.journeys.length,
  };
}

export async function listDemands(args = {}) {
  const payload = await readAllDemands(args);
  const filtered = filterDemands(payload.items, args);

  return {
    meta: {
      ...payload.meta,
      returned: filtered.length,
      filters: args,
    },
    items: args.includeDetails ? filtered : filtered.map(compactDemand),
  };
}

export async function getDemand(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  return readDemand(args.requestId);
}

export async function createDemand(args = {}) {
  const title = String(args.title || "").trim();
  if (!title) throw new Error("title is required");
  const applicationId = String(args.applicationId || "").trim();
  if (!applicationId) throw new Error("applicationId is required");
  const options = await requestOptions();

  return sendJson(
    "/api/requests",
    {
      clientCode: String(args.clientCode || "").trim(),
      title,
      status: String(args.status || options.demandStatus.defaultValue),
      estimatedDeliveryDate: String(args.estimatedDeliveryDate || ""),
      startDate: String(args.startDate || ""),
      endDate: String(args.endDate || ""),
      estimatedJourneys: Number(args.estimatedJourneys) || 0,
      description: String(args.description || "").trim(),
      specification: {
        sections: Array.isArray(args.specificationSections)
          ? args.specificationSections
          : [],
      },
      checklist: Array.isArray(args.checklist) ? args.checklist : [],
      journeys: Array.isArray(args.journeys) ? args.journeys : [],
      collectionId: String(args.collectionId || "").trim(),
      workspaceId: args.workspaceId,
      applicationId,
      affectedComponentIds: Array.isArray(args.affectedComponentIds)
        ? args.affectedComponentIds
        : [],
    },
    {},
    "POST",
  );
}

export async function getJourneyCalendar(args = {}) {
  const payload = await readAllDemands(args);
  const filtered = filterDemands(payload.items, args);
  const fromMonth = String(args.fromMonth || "");
  const toMonth = String(args.toMonth || "");
  const months = new Map();

  for (const request of filtered) {
    for (const item of request.journeys || []) {
      if (fromMonth && item.month < fromMonth) continue;
      if (toMonth && item.month > toMonth) continue;

      const current = months.get(item.month) || {
        month: item.month,
        plannedJourneys: 0,
        executedJourneys: 0,
        pendingJourneys: 0,
        requests: [],
      };
      const plannedJourneys = Number(item.plannedJourneys) || 0;
      const executedJourneys = Number(item.executedJourneys) || 0;

      current.plannedJourneys += plannedJourneys;
      current.executedJourneys += executedJourneys;
      current.pendingJourneys += Math.max(
        0,
        plannedJourneys - executedJourneys,
      );
      current.requests.push({
        id: request.id,
        clientCode: request.clientCode,
        title: request.title,
        status: request.status,
        plannedJourneys,
        executedJourneys,
        comment: item.comment || "",
      });
      months.set(item.month, current);
    }
  }

  return {
    meta: {
      totalRequests: filtered.length,
      fromMonth: fromMonth || null,
      toMonth: toMonth || null,
      status: args.status || null,
    },
    months: [...months.values()].sort((first, second) =>
      first.month.localeCompare(second.month),
    ),
  };
}

export async function getDemandDeadlines(args = {}) {
  const referenceDate = String(args.referenceDate || todayLabel()).slice(0, 10);
  const payload = await readAllDemands(args);
  const filtered = filterDemands(payload.items, args);

  return {
    meta: {
      referenceDate,
      returned: filtered.length,
    },
    items: filtered.map((request) => {
      const daysToEstimatedDelivery = daysBetween(
        referenceDate,
        request.estimatedDeliveryDate,
      );
      const daysToEnd = daysBetween(referenceDate, request.endDate);
      const isDone = request.status === "Concluído";

      return {
        id: request.id,
        clientCode: request.clientCode,
        title: request.title,
        status: request.status,
        estimatedDeliveryDate: request.estimatedDeliveryDate,
        startDate: request.startDate,
        endDate: request.endDate,
        daysToEstimatedDelivery,
        daysToEnd,
        overdue:
          !isDone &&
          daysToEstimatedDelivery !== null &&
          daysToEstimatedDelivery < 0,
        journeys: journeySummaryForRequest(request),
      };
    }),
  };
}

export async function getDemandImplementationContext(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");

  const { request } = await readDemand(args.requestId);
  const sections = request.specification?.sections || [];

  return {
    request: compactDemand(request),
    journeys: journeySummaryForRequest(request),
    checklist: request.checklist,
    specification: {
      sections,
      byTitle: Object.fromEntries(
        sections.map((section) => [section.title, section.content]),
      ),
    },
    notes: args.includeNotes === false ? [] : request.notes,
    tasks: request.tasks || [],
  };
}

async function validateTaskStatus(
  status,
  options,
  allowedHistoricalStatus = "",
) {
  const taskStatus = options?.taskStatus || (await requestOptions()).taskStatus;
  if (
    !taskStatus.values.includes(status) &&
    status !== allowedHistoricalStatus
  ) {
    throw new Error(`status must be one of ${taskStatus.values.join(", ")}`);
  }
}

async function taskPayload(args, current = {}) {
  const options = await requestOptions();
  const status =
    args.status ?? current.status ?? options.taskStatus.defaultValue;
  await validateTaskStatus(status, options, current.status);

  const title = String(args.title ?? current.title ?? "").trim();
  if (!title) throw new Error("title is required");

  return {
    code: String(args.code ?? current.code ?? "").trim(),
    title,
    status,
    startDate: String(args.startDate ?? current.startDate ?? ""),
    endDate: String(args.endDate ?? current.endDate ?? ""),
    situation: String(args.situation ?? current.situation ?? ""),
    description: String(args.description ?? current.description ?? ""),
    specification: String(args.specification ?? current.specification ?? ""),
  };
}

async function readDemandTask(requestId, taskId) {
  const { request } = await readDemand(requestId);
  const task = (request.tasks || []).find((item) => item.id === taskId);
  if (!task) throw new Error(`Demand task not found: ${taskId}`);
  return { request, task };
}

export async function listDemandTasks(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (args.status) await validateTaskStatus(args.status);

  const { request } = await readDemand(args.requestId);
  const tasks = (request.tasks || []).filter(
    (task) => !args.status || task.status === args.status,
  );
  return {
    request: compactDemand(request),
    meta: {
      total: tasks.length,
      status: args.status || null,
    },
    items: tasks,
  };
}

export async function createDemandTask(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");

  const { request } = await readDemand(args.requestId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks`,
    await taskPayload(args),
    {},
    "POST",
  );
}

export async function updateDemandTask(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (!args.taskId) throw new Error("taskId is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}`,
    await taskPayload(args, task),
  );
}

export async function updateDemandTaskStatus(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (!args.taskId) throw new Error("taskId is required");
  await validateTaskStatus(args.status);

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}`,
    await taskPayload({ status: args.status }, task),
  );
}

export async function deleteDemandTask(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (!args.taskId) throw new Error("taskId is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return deleteJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}`,
  );
}

export async function addDemandTaskNote(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (!args.taskId) throw new Error("taskId is required");
  if (!String(args.content || "").trim())
    throw new Error("content is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}/notes`,
    { date: args.date || todayLabel(), content: String(args.content).trim() },
    {},
    "POST",
  );
}

export async function updateDemandTaskNote(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (!args.taskId) throw new Error("taskId is required");
  if (!args.noteId) throw new Error("noteId is required");
  if (!String(args.content || "").trim())
    throw new Error("content is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}/notes/${encodeURIComponent(args.noteId)}`,
    { date: args.date || todayLabel(), content: String(args.content).trim() },
  );
}

export async function deleteDemandTaskNote(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (!args.taskId) throw new Error("taskId is required");
  if (!args.noteId) throw new Error("noteId is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return deleteJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}/notes/${encodeURIComponent(args.noteId)}`,
  );
}

export async function addDemandNote(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (!String(args.content || "").trim())
    throw new Error("content is required");

  return sendJson(
    `/api/requests/${encodeURIComponent(args.requestId)}/notes`,
    {
      date: args.date || todayLabel(),
      content: args.content,
    },
    {},
    "POST",
  );
}

export async function updateDemandDescription(args = {}) {
  if (!args.requestId) throw new Error("requestId is required");
  if (!String(args.description || "").trim())
    throw new Error("description is required");

  const { request } = await readDemand(args.requestId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}`,
    cleanParams({
      ...request,
      description: String(args.description).trim(),
    }),
  );
}
