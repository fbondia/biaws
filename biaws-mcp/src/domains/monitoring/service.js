import {
  cleanParams,
  deleteJson,
  fetchJson,
  sendJson,
} from "../../httpClient.js";

const TEMPLATE_BASE = "/api/monitoring/templates";

function requiredId(args, field) {
  const value = String(args?.[field] || "").trim();
  if (!value) throw new Error(`${field} is required`);
  return value;
}

function segment(value) {
  return encodeURIComponent(value);
}

function templatePath(args, suffix = "") {
  const templateId = requiredId(args, "templateId");
  return `${TEMPLATE_BASE}/${segment(templateId)}${suffix}`;
}

function templateVersionPath(args, operation = "") {
  const version = requiredId(args, "version");
  const suffix = operation ? `/${operation}` : "";
  return templatePath(args, `/versions/${segment(version)}${suffix}`);
}

function activeMonitorsPath(args, monitor = false) {
  const runtimeReference = requiredId(args, "runtimeReference");
  const base = `/api/monitoring/runtimes/${segment(runtimeReference)}/active-monitors`;
  return monitor ? `${base}/${segment(requiredId(args, "monitorId"))}` : base;
}

function runtimeMonitoringTimelinePath(args) {
  const runtimeReference = requiredId(args, "runtimeReference");
  return `/api/monitoring/runtimes/${segment(runtimeReference)}/timeline`;
}

function payload(args, omitted) {
  const excluded = new Set(omitted);
  const result = Object.fromEntries(
    Object.entries(args).filter(
      ([field, value]) => !excluded.has(field) && value !== undefined,
    ),
  );
  if (!Object.keys(result).length) {
    throw new Error("at least one mutable field is required");
  }
  return result;
}

export function listMonitoringTemplates(args = {}) {
  return fetchJson(
    TEMPLATE_BASE,
    cleanParams({ status: args.status, page: args.page, limit: args.limit }),
  );
}

export function getMonitoringTemplate(args = {}) {
  return fetchJson(templatePath(args), cleanParams({ version: args.version }));
}

export function previewMonitoringTemplate(args = {}) {
  return sendJson(`${TEMPLATE_BASE}/preview`, payload(args, []), {}, "POST");
}

export function createMonitoringTemplate(args = {}) {
  return sendJson(TEMPLATE_BASE, payload(args, []), {}, "POST");
}

export function createMonitoringTemplateVersion(args = {}) {
  return sendJson(
    templatePath(args),
    payload(args, ["templateId"]),
    {},
    "PATCH",
  );
}

export function getMonitoringTemplateUsage(args = {}) {
  return fetchJson(templateVersionPath(args, "usage"));
}

export function getMonitoringTemplateContract(args = {}) {
  return fetchJson(templateVersionPath(args, "contract"));
}

export function validateMonitoringTemplateSample(args = {}) {
  return sendJson(
    templateVersionPath(args, "validate"),
    { sample: args.sample },
    {},
    "POST",
  );
}

function setMonitoringTemplateStatus(args, operation) {
  return sendJson(templateVersionPath(args, operation), {}, {}, "POST");
}

export function activateMonitoringTemplate(args = {}) {
  return setMonitoringTemplateStatus(args, "activate");
}

export function deactivateMonitoringTemplate(args = {}) {
  return setMonitoringTemplateStatus(args, "deactivate");
}

export function archiveMonitoringTemplate(args = {}) {
  return deleteJson(templateVersionPath(args));
}

export function listRuntimeActiveMonitors(args = {}) {
  return fetchJson(
    activeMonitorsPath(args),
    cleanParams({ page: args.page, limit: args.limit }),
  );
}

export function listRuntimeMonitoringResults(args = {}) {
  return fetchJson(
    runtimeMonitoringTimelinePath(args),
    cleanParams({
      observedFrom: args.observedFrom,
      observedTo: args.observedTo,
      status: args.status,
      page: args.page,
      limit: args.limit,
    }),
  );
}

export function createRuntimeActiveMonitor(args = {}) {
  return sendJson(
    activeMonitorsPath(args),
    payload(args, ["runtimeReference"]),
    {},
    "POST",
  );
}

export function updateRuntimeActiveMonitor(args = {}) {
  return sendJson(
    activeMonitorsPath(args, true),
    payload(args, ["runtimeReference", "monitorId"]),
    {},
    "PATCH",
  );
}

export function archiveRuntimeActiveMonitor(args = {}) {
  return deleteJson(activeMonitorsPath(args, true));
}
