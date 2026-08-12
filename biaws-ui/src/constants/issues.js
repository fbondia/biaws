import {
  ISSUE_STATUS_OPTIONS as FALLBACK_STATUS_OPTIONS,
  ISSUE_TYPE_OPTIONS as FALLBACK_TYPE_OPTIONS,
} from "../../../shared/issueConstants.js";

export const DEFAULT_FILTERS = {
  applicationId: "",
  componentId: "",
  texto: "",
  codigo: "",
  type: "",
  status: "",
  dateField: "receivedEmailAt",
  from: "",
  to: "",
};

export const DEFAULT_TAG_GROUP_COLOR = "#2d6cdf";

export const DATE_FIELDS = [
  { value: "receivedEmailAt", label: "Recebimento" },
  { value: "issueCreatedAt", label: "Criação" },
  { value: "firstThreadEmailAt", label: "Primeiro e-mail" },
  { value: "closedAt", label: "Fechamento" },
  { value: "updatedAt", label: "Atualização" },
];

export const TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  ...FALLBACK_TYPE_OPTIONS,
];
export const ALL_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  ...FALLBACK_TYPE_OPTIONS,
];

export const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  ...FALLBACK_STATUS_OPTIONS,
];
export const ALL_STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  ...FALLBACK_STATUS_OPTIONS,
];

function replaceOptions(target, items, activeOnly = true) {
  target.splice(
    0,
    target.length,
    { value: "", label: "Todos" },
    ...items
      .filter((item) => !activeOnly || item.active !== false)
      .map((item) => ({ value: item.value, label: item.label || item.value })),
  );
}

export function resetIssueConstants() {
  replaceOptions(TYPE_OPTIONS, FALLBACK_TYPE_OPTIONS);
  replaceOptions(ALL_TYPE_OPTIONS, FALLBACK_TYPE_OPTIONS, false);
  replaceOptions(STATUS_OPTIONS, FALLBACK_STATUS_OPTIONS);
  replaceOptions(ALL_STATUS_OPTIONS, FALLBACK_STATUS_OPTIONS, false);
}

export function configureIssueConstants(optionLists = []) {
  resetIssueConstants();
  const byKey = Object.fromEntries(optionLists.map((list) => [list.key, list]));

  if (byKey["issue.type"]) {
    replaceOptions(TYPE_OPTIONS, byKey["issue.type"].items || []);
    replaceOptions(ALL_TYPE_OPTIONS, byKey["issue.type"].items || [], false);
  }
  if (byKey["issue.status"]) {
    replaceOptions(STATUS_OPTIONS, byKey["issue.status"].items || []);
    replaceOptions(
      ALL_STATUS_OPTIONS,
      byKey["issue.status"].items || [],
      false,
    );
  }
}

export const AGGREGATE_TABS = [
  { key: "byDate", label: "Dia" },
  { key: "byWeek", label: "Semana" },
  { key: "byMonth", label: "Mês" },
  { key: "byYear", label: "Ano" },
  { key: "byType", label: "Tipo" },
  { key: "byStatus", label: "Status" },
  { key: "byTaxonomy", label: "Assunto" },
];
