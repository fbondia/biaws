import {
  REQUEST_ALL_TASK_STATUS_OPTIONS,
  REQUEST_CHECKLIST_ITEMS,
  REQUEST_DEFAULTS,
  REQUEST_SPECIFICATION_SECTION_TITLES,
} from "../../../data/requestConstants.js";
import { monthKeysBetween, scheduleSortValue } from "./dates.js";
import { dateTimeValue, requestListRankValue } from "./ordering.js";
import { normalizeRequestStatus } from "./status.js";

export function requestChecklist(items = []) {
  const byLabel = new Map(items.map((item) => [item.label, item]));
  const labels = [
    ...REQUEST_CHECKLIST_ITEMS,
    ...items.map((item) => item.label),
  ].filter((label, index, values) => label && values.indexOf(label) === index);

  return labels.map((label) => ({
    label,
    done: Boolean(byLabel.get(label)?.done),
    date: byLabel.get(label)?.date || "",
    comment: byLabel.get(label)?.comment || "",
  }));
}

export function journeyRowsForRequest(request) {
  const currentJourneys = new Map(
    (request.journeys || request.billing || []).map((item) => [
      item.month,
      {
        plannedJourneys: Number(item.plannedJourneys ?? item.journeys) || 0,
        executedJourneys:
          Number(item.executedJourneys ?? item.billedJourneys) || 0,
        comment: item.comment || "",
      },
    ]),
  );

  return monthKeysBetween(request.startDate, request.endDate).map((month) => {
    const current = currentJourneys.get(month) || {};

    return {
      month,
      plannedJourneys: current.plannedJourneys || 0,
      executedJourneys: current.executedJourneys || 0,
      comment: current.comment || "",
    };
  });
}

export function defaultSpecificationSections() {
  return REQUEST_SPECIFICATION_SECTION_TITLES.map((title, index) => ({
    id: `default-${index + 1}`,
    title,
    content: "",
    order: index,
  }));
}

export function normalizeSpecificationSectionTitle(title) {
  return String(title || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function createDefaultSpecificationSection(title) {
  const defaultIndex = REQUEST_SPECIFICATION_SECTION_TITLES.findIndex(
    (sectionTitle) =>
      normalizeSpecificationSectionTitle(sectionTitle) ===
      normalizeSpecificationSectionTitle(title),
  );

  return {
    id: `default-${defaultIndex >= 0 ? defaultIndex + 1 : Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    content: "",
    order: 0,
  };
}

export function normalizeSpecification(specification) {
  const sections = Array.isArray(specification)
    ? specification
    : Array.isArray(specification?.sections)
      ? specification.sections
      : defaultSpecificationSections();

  return {
    sections: sections
      .map((section, index) => ({
        id: String(section?.id || `section-${index + 1}`),
        title: String(section?.title || "Nova seção"),
        content: String(section?.content || ""),
        order: Number.isFinite(Number(section?.order))
          ? Number(section.order)
          : index,
      }))
      .sort((first, second) => first.order - second.order)
      .map((section, index) => ({ ...section, order: index })),
  };
}

export function normalizeRequestNotes(notes) {
  if (Array.isArray(notes)) {
    return notes
      .map((note, index) => ({
        id: String(note?.id || `draft-note-${index + 1}`),
        date: String(note?.date || ""),
        content: String(note?.content || ""),
        createdAt: note?.createdAt || null,
        updatedAt: note?.updatedAt || null,
      }))
      .sort((first, second) => {
        return (
          scheduleSortValue(second.date) - scheduleSortValue(first.date) ||
          dateTimeValue(second.createdAt) - dateTimeValue(first.createdAt)
        );
      });
  }

  const content = String(notes || "").trim();
  return content
    ? [
        {
          id: "legacy-note",
          date: "",
          content,
          createdAt: null,
          updatedAt: null,
        },
      ]
    : [];
}

export function normalizeRequestTasks(tasks) {
  return (Array.isArray(tasks) ? tasks : []).map((task, index) => ({
    id: String(task?.id || `draft-task-${index + 1}`),
    requestId: String(task?.requestId || ""),
    code: String(task?.code || ""),
    title: String(task?.title || ""),
    status: REQUEST_ALL_TASK_STATUS_OPTIONS.includes(task?.status)
      ? task.status
      : REQUEST_DEFAULTS.taskStatus,
    startDate: String(task?.startDate || ""),
    endDate: String(task?.endDate || ""),
    situation: String(task?.situation || ""),
    description: String(task?.description || ""),
    specification: String(task?.specification || ""),
    notes: normalizeRequestNotes(task?.notes),
    createdAt: task?.createdAt || null,
    updatedAt: task?.updatedAt || null,
  }));
}

export function todayDateValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;

  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function createSpecificationSection() {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "Nova seção",
    content: "",
    order: 0,
  };
}

export function normalizeRequest(request) {
  return {
    ...request,
    applicationId: String(request.applicationId || ""),
    affectedComponentIds: Array.isArray(request.affectedComponentIds)
      ? request.affectedComponentIds
      : [],
    listRank: requestListRankValue(request),
    status: normalizeRequestStatus(request.status),
    description: request.description || "",
    notes: normalizeRequestNotes(request.notes),
    tasks: normalizeRequestTasks(request.tasks),
    checklist: requestChecklist(request.checklist),
    journeys: journeyRowsForRequest(request),
    specification: normalizeSpecification(request.specification),
  };
}

export function newRequest() {
  const now = Date.now();

  return normalizeRequest({
    id: `draft-${now}`,
    applicationId: "",
    affectedComponentIds: [],
    clientCode: "",
    title: "",
    status: REQUEST_DEFAULTS.status,
    estimatedDeliveryDate: "",
    startDate: "",
    endDate: "",
    estimatedJourneys: 0,
    description: "",
    notes: [],
    tasks: [],
    listRank: now,
    checklist: [],
    journeys: [],
    specification: {
      sections: defaultSpecificationSections(),
    },
  });
}
