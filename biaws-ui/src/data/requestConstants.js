import {
  DEFAULT_REQUEST_STATUS as FALLBACK_REQUEST_STATUS,
  DEFAULT_REQUEST_TASK_STATUS as FALLBACK_TASK_STATUS,
  REQUEST_CHECKLIST_ITEMS as FALLBACK_CHECKLIST_ITEMS,
  REQUEST_SPECIFICATION_SECTION_TITLES as FALLBACK_SPECIFICATION_TITLES,
  REQUEST_STATUS_COLORS as FALLBACK_STATUS_COLORS,
  REQUEST_STATUS_OPTIONS as FALLBACK_STATUS_OPTIONS,
  REQUEST_TASK_STATUS_COLORS as FALLBACK_TASK_COLORS,
  REQUEST_TASK_STATUS_OPTIONS as FALLBACK_TASK_STATUS_OPTIONS,
} from "../../../shared/requestConstants.js";

export const REQUEST_DEFAULTS = {
  status: FALLBACK_REQUEST_STATUS,
  taskStatus: FALLBACK_TASK_STATUS,
};
export const REQUEST_CHECKLIST_ITEMS = [...FALLBACK_CHECKLIST_ITEMS];
export const REQUEST_SPECIFICATION_SECTION_TITLES = [
  ...FALLBACK_SPECIFICATION_TITLES,
];
export const REQUEST_STATUS_OPTIONS = [...FALLBACK_STATUS_OPTIONS];
export const REQUEST_ALL_STATUS_OPTIONS = [...FALLBACK_STATUS_OPTIONS];
export const REQUEST_STATUS_COLORS = structuredClone(FALLBACK_STATUS_COLORS);
export const REQUEST_TASK_STATUS_COLORS = structuredClone(FALLBACK_TASK_COLORS);
export const REQUEST_TASK_STATUS_OPTIONS = [...FALLBACK_TASK_STATUS_OPTIONS];
export const REQUEST_ALL_TASK_STATUS_OPTIONS = [
  ...FALLBACK_TASK_STATUS_OPTIONS,
];
export const REQUEST_OPTION_LABELS = {};

function activeItems(list) {
  return (list?.items || []).filter((item) => item.active !== false);
}

function replaceArray(target, values) {
  target.splice(0, target.length, ...values);
}

export function configureRequestConstants(optionLists = []) {
  const byKey = Object.fromEntries(optionLists.map((list) => [list.key, list]));
  const demandStatuses = activeItems(byKey["demand.status"]);
  const taskStatuses = activeItems(byKey["demand.task-status"]);
  const checklist = activeItems(byKey["demand.checklist"]);
  const specificationSections = activeItems(
    byKey["demand.specification-sections"],
  );
  for (const key of Object.keys(REQUEST_OPTION_LABELS))
    delete REQUEST_OPTION_LABELS[key];
  for (const list of optionLists) {
    REQUEST_OPTION_LABELS[list.key] = Object.fromEntries(
      (list.items || []).map((item) => [item.value, item.label || item.value]),
    );
  }

  if (demandStatuses.length) {
    replaceArray(
      REQUEST_STATUS_OPTIONS,
      demandStatuses.map((item) => item.value),
    );
    replaceArray(
      REQUEST_ALL_STATUS_OPTIONS,
      (byKey["demand.status"].items || []).map((item) => item.value),
    );
    REQUEST_DEFAULTS.status =
      byKey["demand.status"].defaultValue || REQUEST_STATUS_OPTIONS[0];
    for (const key of Object.keys(REQUEST_STATUS_COLORS))
      delete REQUEST_STATUS_COLORS[key];
    for (const item of demandStatuses) {
      REQUEST_STATUS_COLORS[item.value] = {
        ...(FALLBACK_STATUS_COLORS[item.value] || {}),
        ...(item.metadata || {}),
      };
    }
  }
  if (taskStatuses.length) {
    replaceArray(
      REQUEST_TASK_STATUS_OPTIONS,
      taskStatuses.map((item) => item.value),
    );
    replaceArray(
      REQUEST_ALL_TASK_STATUS_OPTIONS,
      (byKey["demand.task-status"].items || []).map((item) => item.value),
    );
    REQUEST_DEFAULTS.taskStatus =
      byKey["demand.task-status"].defaultValue ||
      REQUEST_TASK_STATUS_OPTIONS[0];
    for (const key of Object.keys(REQUEST_TASK_STATUS_COLORS))
      delete REQUEST_TASK_STATUS_COLORS[key];
    for (const item of taskStatuses)
      REQUEST_TASK_STATUS_COLORS[item.value] = item.metadata || {};
  }
  if (byKey["demand.checklist"])
    replaceArray(
      REQUEST_CHECKLIST_ITEMS,
      checklist.map((item) => item.value),
    );
  if (byKey["demand.specification-sections"]) {
    replaceArray(
      REQUEST_SPECIFICATION_SECTION_TITLES,
      specificationSections.map((item) => item.value),
    );
  }
}

export function requestOptionLabel(key, value) {
  return REQUEST_OPTION_LABELS[key]?.[value] || value;
}
