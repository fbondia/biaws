import {
  requireEntity,
  type ApiEntity,
  type ApiMeta,
} from "../../api/apiContracts.js";
import type { ServiceArguments } from "../../mcp/tools/contracts.js";
import { BiawsError } from "../../runtime/errors.js";
import {
  cleanParams,
  deleteJson,
  fetchJson,
  sendJson,
} from "../../api/httpClient.js";

// A API fornece as opções em runtime; estes valores preservam compatibilidade
// somente quando uma instalação antiga ainda não publicou as listas.
const DEFAULT_REQUEST_STATUS = "Sugerido";
const DEFAULT_REQUEST_TASK_STATUS = "Pendente";

async function requestOptions() {
  const payload = await fetchJson("/api/option-lists/runtime");
  const byKey: Record<string, ApiEntity> = Object.fromEntries(
    (payload.items || []).map((list) => [list.key, list]),
  );
  const read = (key: string, fallback: string) => {
    const list = byKey[key];
    return {
      values: (list?.items || [])
        .filter((item) => item.active !== false)
        .map((item) => item.value || ""),
      defaultValue: list?.defaultValue || fallback,
    };
  };
  return {
    demandStatus: read("demand.status", DEFAULT_REQUEST_STATUS),
    taskStatus: read("demand.task-status", DEFAULT_REQUEST_TASK_STATUS),
  };
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function todayLabel() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start: unknown, end: unknown) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
}

function filterDemands(items: ApiEntity[], args: Record<string, unknown> = {}) {
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
          (typeof request.specification === "object"
            ? request.specification?.sections
            : undefined
          )
            ?.map((section) => `${section.title} ${section.content}`)
            .join(" "),
        ].join(" "),
      );
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}

function compactDemand(request: ApiEntity) {
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

async function readDemandPage(
  args: Record<string, unknown> = {},
  page = 1,
  limit = 25,
) {
  return fetchJson(
    "/api/requests",
    cleanParams({
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      componentId: args.componentId,
      collectionId: args.collectionId,
      status: args.status,
      page,
      limit,
    }),
  );
}

async function readAllDemands(args: Record<string, unknown> = {}) {
  const items: ApiEntity[] = [];
  let meta: ApiMeta = {};
  // Bound traversal without returning an apparently complete partial result.
  for (let page = 1; page <= 100; page += 1) {
    const payload = await readDemandPage(args, page, 100);
    items.push(...(payload.items || []));
    meta = payload.meta || {};
    const totalPages = Number(
      meta.totalPages ?? Math.ceil(Number(meta.total) / 100),
    );
    if (!Number.isFinite(totalPages) || page >= totalPages) {
      return { meta, items };
    }
  }
  const error = new BiawsError(
    "Demand scan exceeds 100 pages; narrow the application, component, status or collection filters",
  );
  error.code = "DEMAND_SCAN_LIMIT_EXCEEDED";
  error.retryable = false;
  throw error;
}

async function readDemand(requestId: string) {
  const payload = await fetchJson(
    `/api/requests/${encodeURIComponent(requestId)}`,
  );
  const request = requireEntity(payload.request);
  if (!request) throw new BiawsError(`Demand not found: ${requestId}`);
  return {
    meta: payload.meta || {},
    request,
  };
}

function journeySummaryForRequest(request: ApiEntity) {
  const plannedJourneys = (request.journeys || []).reduce(
    (total, item) => total + (Number(item.plannedJourneys) || 0),
    0,
  );
  const executedJourneys = (request.journeys || []).reduce(
    (total, item) => total + (Number(item.executedJourneys) || 0),
    0,
  );

  return {
    plannedJourneys,
    executedJourneys,
    pendingJourneys: Math.max(0, plannedJourneys - executedJourneys),
    months: (request.journeys || []).length,
  };
}

export async function listDemands(args: ServiceArguments<"demands_list"> = {}) {
  const page = args.page ?? 1;
  const limit = args.limit ?? 25;
  // Text and partial-code matching remain MCP filters; filter before paging.
  const locallyFiltered = Boolean(args.text || args.code);
  const payload = locallyFiltered
    ? await readAllDemands(args)
    : await readDemandPage(args, page, limit);
  const filtered = filterDemands(payload.items || [], args);
  const items = locallyFiltered
    ? filtered.slice((page - 1) * limit, page * limit)
    : filtered;
  const total = locallyFiltered
    ? filtered.length
    : (payload.meta?.total ?? filtered.length);
  return {
    meta: {
      ...payload.meta,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      returned: items.length,
      filters: args,
    },
    items: args.includeDetails ? items : items.map(compactDemand),
  };
}

export async function getDemand(args: ServiceArguments<"demands_get"> = {}) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  return readDemand(args.requestId);
}

export async function createDemand(
  args: ServiceArguments<"demands_create"> = {},
) {
  const title = String(args.title || "").trim();
  if (!title) throw new BiawsError("title is required");
  const applicationId = String(args.applicationId || "").trim();
  if (!applicationId) throw new BiawsError("applicationId is required");
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

export async function getJourneyCalendar(
  args: ServiceArguments<"demands_journey_calendar"> = {},
) {
  const payload = await readAllDemands(args);
  const filtered = filterDemands(payload.items || [], args);
  const fromMonth = String(args.fromMonth || "");
  const toMonth = String(args.toMonth || "");
  const months = new Map<
    string,
    {
      month: string;
      plannedJourneys: number;
      executedJourneys: number;
      pendingJourneys: number;
      requests: {
        id?: string;
        clientCode?: string;
        title?: string;
        status?: string;
        plannedJourneys: number;
        executedJourneys: number;
        comment: string;
      }[];
    }
  >();

  for (const request of filtered) {
    for (const item of request.journeys || []) {
      if (!item.month) throw new Error("journey.month is required");
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

export async function getDemandDeadlines(
  args: ServiceArguments<"demands_deadlines"> = {},
) {
  const referenceDate = String(args.referenceDate || todayLabel()).slice(0, 10);
  const payload = await readAllDemands(args);
  const filtered = filterDemands(payload.items || [], args);

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

export async function getDemandImplementationContext(
  args: ServiceArguments<"demands_implementation_context"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");

  const { request } = await readDemand(args.requestId);
  const sections =
    (typeof request.specification === "object"
      ? request.specification?.sections
      : undefined) || [];

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
  status: string | undefined,
  options?: Awaited<ReturnType<typeof requestOptions>>,
  allowedHistoricalStatus = "",
) {
  const taskStatus = options?.taskStatus || (await requestOptions()).taskStatus;
  if (
    !taskStatus.values.includes(status || "") &&
    status !== allowedHistoricalStatus
  ) {
    throw new BiawsError(
      `status must be one of ${taskStatus.values.join(", ")}`,
    );
  }
}

async function taskPayload(args: Partial<ApiEntity>, current: ApiEntity = {}) {
  const options = await requestOptions();
  const status =
    args.status ?? current.status ?? options.taskStatus.defaultValue;
  await validateTaskStatus(status, options, current.status);

  const title = String(args.title ?? current.title ?? "").trim();
  if (!title) throw new BiawsError("title is required");

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

async function readDemandTask(requestId: string, taskId: string) {
  const { request } = await readDemand(requestId);
  let task = (request.tasks || []).find((item) => item.id === taskId);
  if (!task) {
    const matches = (request.tasks || []).filter(
      (item) => String(item.code || "").toLowerCase() === taskId.toLowerCase(),
    );
    if (matches.length > 1)
      throw new BiawsError("Ambiguous task identifier; use its ID");
    task = matches[0];
  }
  if (!task) throw new BiawsError(`Demand task not found: ${taskId}`);
  return { request, task: requireEntity(task) };
}

export async function listDemandTasks(
  args: ServiceArguments<"demands_list_tasks"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
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

export async function createDemandTask(
  args: ServiceArguments<"demands_create_task"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");

  const { request } = await readDemand(args.requestId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks`,
    await taskPayload(args),
    {},
    "POST",
  );
}

export async function updateDemandTask(
  args: ServiceArguments<"demands_update_task"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  if (!args.taskId) throw new BiawsError("taskId is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}`,
    await taskPayload(args, task),
  );
}

export async function updateDemandTaskStatus(
  args: ServiceArguments<"demands_update_task_status"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  if (!args.taskId) throw new BiawsError("taskId is required");
  await validateTaskStatus(args.status);

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}`,
    await taskPayload({ status: args.status }, task),
  );
}

export async function deleteDemandTask(
  args: ServiceArguments<"demands_delete_task"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  if (!args.taskId) throw new BiawsError("taskId is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return deleteJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}`,
  );
}

export async function addDemandTaskNote(
  args: ServiceArguments<"demands_add_task_note"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  if (!args.taskId) throw new BiawsError("taskId is required");
  if (!String(args.content || "").trim())
    throw new BiawsError("content is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}/notes`,
    { date: args.date || todayLabel(), content: String(args.content).trim() },
    {},
    "POST",
  );
}

export async function updateDemandTaskNote(
  args: ServiceArguments<"demands_update_task_note"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  if (!args.taskId) throw new BiawsError("taskId is required");
  if (!args.noteId) throw new BiawsError("noteId is required");
  if (!String(args.content || "").trim())
    throw new BiawsError("content is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}/notes/${encodeURIComponent(args.noteId)}`,
    { date: args.date || todayLabel(), content: String(args.content).trim() },
  );
}

export async function deleteDemandTaskNote(
  args: ServiceArguments<"demands_delete_task_note"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  if (!args.taskId) throw new BiawsError("taskId is required");
  if (!args.noteId) throw new BiawsError("noteId is required");

  const { request, task } = await readDemandTask(args.requestId, args.taskId);
  return deleteJson(
    `/api/requests/${encodeURIComponent(request.id)}/tasks/${encodeURIComponent(task.id)}/notes/${encodeURIComponent(args.noteId)}`,
  );
}

export async function addDemandNote(
  args: ServiceArguments<"demands_add_note"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  if (!String(args.content || "").trim())
    throw new BiawsError("content is required");

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

export async function updateDemandDescription(
  args: ServiceArguments<"demands_update_description"> = {},
) {
  if (!args.requestId) throw new BiawsError("requestId is required");
  if (!String(args.description || "").trim())
    throw new BiawsError("description is required");

  return updateDemandFields(args, {
    description: String(args.description).trim(),
  });
}

function requiredText(value: unknown, field: string) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new BiawsError(`${field} is required`);
  return normalized;
}

async function updateDemandFields(
  args: { requestId?: string },
  payload: Record<string, unknown> & { journeys?: { month: string }[] },
) {
  const requestId = requiredText(args.requestId, "requestId");
  const { request } = await readDemand(requestId);
  if (payload.journeys) {
    const from = String(request.startDate || "").slice(0, 7);
    const to = String(request.endDate || "").slice(0, 7);
    if (
      payload.journeys.some(
        (item) => !from || !to || item.month < from || item.month > to,
      )
    ) {
      throw new BiawsError(
        "journeys.month must fall within the demand startDate/endDate; update its dates first",
      );
    }
  }
  // The API merges omitted fields and enforces field-specific permissions.
  return sendJson(`/api/requests/${encodeURIComponent(request.id)}`, payload);
}

export async function updateDemand(
  args: ServiceArguments<"demands_update"> = {},
) {
  const fields = [
    "clientCode",
    "title",
    "description",
    "status",
    "estimatedDeliveryDate",
    "startDate",
    "endDate",
    "estimatedJourneys",
    "applicationId",
    "affectedComponentIds",
  ] as const;
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    if (args[field] === undefined) continue;
    payload[field] =
      typeof args[field] === "string" ? args[field].trim() : args[field];
    if (["title", "status", "applicationId"].includes(field)) {
      payload[field] = requiredText(args[field], field);
    }
  }
  if (!Object.keys(payload).length)
    throw new BiawsError("At least one update field is required");
  if (Array.isArray(payload.affectedComponentIds)) {
    payload.affectedComponentIds = payload.affectedComponentIds.map((id) =>
      requiredText(id, "affectedComponentIds"),
    );
    assertUnique(
      Array.isArray(payload.affectedComponentIds)
        ? payload.affectedComponentIds
        : [],
      "affectedComponentIds",
    );
  }
  return updateDemandFields(args, payload);
}

function assertUnique(values: unknown[], field: string) {
  if (new Set(values).size !== values.length)
    throw new BiawsError(`${field} must be unique`);
}

export async function updateDemandSpecification(
  args: ServiceArguments<"demands_update_specification"> = {},
) {
  const sections = (args.specificationSections || []).map((section) => ({
    ...section,
    id: requiredText(section.id, "section.id"),
    title: requiredText(section.title, "section.title"),
  }));
  assertUnique(
    sections.map((section) => section.id),
    "section.id",
  );
  return updateDemandFields(args, { specification: { sections } });
}

export async function updateDemandChecklist(
  args: ServiceArguments<"demands_update_checklist"> = {},
) {
  const checklist = (args.checklist || []).map((item) => ({
    ...item,
    label: requiredText(item.label, "checklist.label"),
  }));
  assertUnique(
    checklist.map((item) => item.label),
    "checklist.label",
  );
  return updateDemandFields(args, { checklist });
}

export async function updateDemandJourneys(
  args: ServiceArguments<"demands_update_journeys"> = {},
) {
  assertUnique(
    (args.journeys || []).map((item) => item.month),
    "journeys.month",
  );
  return updateDemandFields(args, { journeys: args.journeys });
}

async function readDemandNote(args: { requestId?: string; noteId?: string }) {
  const requestId = requiredText(args.requestId, "requestId");
  const noteId = requiredText(args.noteId, "noteId");
  const { request } = await readDemand(requestId);
  const note = (request.notes || []).find((item) => item.id === noteId);
  if (!note) throw new BiawsError(`Demand note not found: ${noteId}`);
  return { request, note: requireEntity(note) };
}

export async function updateDemandNote(
  args: ServiceArguments<"demands_update_note"> = {},
) {
  const content = requiredText(args.content, "content");
  const { request, note } = await readDemandNote(args);
  return sendJson(
    `/api/requests/${encodeURIComponent(request.id)}/notes/${encodeURIComponent(note.id)}`,
    { content, date: args.date ?? note.date },
  );
}

export async function deleteDemandNote(
  args: ServiceArguments<"demands_delete_note"> = {},
) {
  const { request, note } = await readDemandNote(args);
  return deleteJson(
    `/api/requests/${encodeURIComponent(request.id)}/notes/${encodeURIComponent(note.id)}`,
  );
}
