export const DEFAULT_ISSUE_TYPE = "incident";
export const DEFAULT_ISSUE_STATUS = "open";

export const ISSUE_TYPE_OPTIONS = Object.freeze([
  { value: "incident", label: "Incidente" },
  { value: "request", label: "Requisição" },
]);

export const ISSUE_STATUS_OPTIONS = Object.freeze([
  { value: "open", label: "Aberto" },
  { value: "closed", label: "Fechado" },
]);
