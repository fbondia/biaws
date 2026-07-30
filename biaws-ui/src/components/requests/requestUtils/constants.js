import {
  REQUEST_DEFAULTS,
  REQUEST_CHECKLIST_ITEMS,
  REQUEST_SPECIFICATION_SECTION_TITLES,
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_OPTIONS,
  REQUEST_ALL_STATUS_OPTIONS,
  REQUEST_TASK_STATUS_COLORS,
  REQUEST_TASK_STATUS_OPTIONS,
  REQUEST_ALL_TASK_STATUS_OPTIONS,
  requestOptionLabel,
} from "../../../data/requestConstants.js";

export {
  REQUEST_CHECKLIST_ITEMS,
  REQUEST_SPECIFICATION_SECTION_TITLES,
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_OPTIONS,
  REQUEST_TASK_STATUS_COLORS,
  REQUEST_TASK_STATUS_OPTIONS,
};

export const REQUEST_DETAIL_TABS = [
  { key: "main", label: "Dados principais" },
  { key: "specification", label: "Especificação" },
  { key: "tasks", label: "Tarefas" },
  { key: "notes", label: "Anotações" },
  { key: "checklist", label: "Checklist" },
  { key: "files", label: "Arquivos" },
  { key: "history", label: "Histórico" },
  { key: "billing", label: "Faturamento" },
];

export const REQUEST_OVERVIEW_TABS = [
  { key: "tasks", label: "Tarefas" },
  { key: "schedule", label: "Cronograma" },
  { key: "billing", label: "Faturamento" },
];

export const REQUEST_SAVE_DEBOUNCE_MS = 5000;
