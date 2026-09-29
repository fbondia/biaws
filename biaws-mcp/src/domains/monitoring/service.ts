import type { ServiceArguments } from "../../mcp/tools/contracts.js";
import { BiawsError } from "../../runtime/errors.js";
import {
  cleanParams,
  deleteJson,
  fetchJson,
  sendJson,
} from "../../api/httpClient.js";

const TEMPLATE_BASE = "/api/monitoring/templates";

function requiredId(args: Record<string, unknown>, field: string) {
  const value = String(args?.[field] || "").trim();
  if (!value) throw new BiawsError(`${field} is required`);
  return value;
}

function segment(value: string) {
  return encodeURIComponent(value);
}

function templatePath(args: Record<string, unknown>, suffix = "") {
  const templateId = requiredId(args, "templateId");
  return `${TEMPLATE_BASE}/${segment(templateId)}${suffix}`;
}

function templateVersionPath(args: Record<string, unknown>, operation = "") {
  const version = requiredId(args, "version");
  const suffix = operation ? `/${operation}` : "";
  return templatePath(args, `/versions/${segment(version)}${suffix}`);
}

function activeMonitorsPath(args: Record<string, unknown>, monitor = false) {
  const runtimeReference = requiredId(args, "runtimeReference");
  const base = `/api/monitoring/runtimes/${segment(runtimeReference)}/active-monitors`;
  return monitor ? `${base}/${segment(requiredId(args, "monitorId"))}` : base;
}

function runtimeMonitoringTimelinePath(args: Record<string, unknown>) {
  const runtimeReference = requiredId(args, "runtimeReference");
  return `/api/monitoring/runtimes/${segment(runtimeReference)}/timeline`;
}

function runtimeMonitoringHealthSummaryPath(args: Record<string, unknown>) {
  const runtimeReference = requiredId(args, "runtimeReference");
  return `/api/monitoring/runtimes/${segment(runtimeReference)}/health-summary`;
}

function payload(args: Record<string, unknown>, omitted: string[]) {
  const excluded = new Set(omitted);
  const result = Object.fromEntries(
    Object.entries(args).filter(
      ([field, value]) => !excluded.has(field) && value !== undefined,
    ),
  );
  if (!Object.keys(result).length) {
    throw new BiawsError("at least one mutable field is required");
  }
  return result;
}

export function listMonitoringTemplates(
  args: ServiceArguments<"monitoring_templates_list"> = {},
) {
  return fetchJson(
    TEMPLATE_BASE,
    cleanParams({ status: args.status, page: args.page, limit: args.limit }),
  );
}

export function previewMonitoringTemplate(
  args: ServiceArguments<"monitoring_templates_preview"> = {},
) {
  return sendJson(`${TEMPLATE_BASE}/preview`, payload(args, []), {}, "POST");
}

export function createMonitoringTemplate(
  args: ServiceArguments<"monitoring_templates_create"> = {},
) {
  return sendJson(TEMPLATE_BASE, payload(args, []), {}, "POST");
}

export function createMonitoringTemplateVersion(
  args: ServiceArguments<"monitoring_templates_create_version"> = {},
) {
  return sendJson(
    templatePath(args),
    payload(args, ["templateId"]),
    {},
    "PATCH",
  );
}

export function validateMonitoringTemplateSample(
  args: ServiceArguments<"monitoring_templates_validate"> = {},
) {
  return sendJson(
    templateVersionPath(args, "validate"),
    { sample: args.sample },
    {},
    "POST",
  );
}

function setMonitoringTemplateStatus(
  args: Record<string, unknown>,
  operation: string,
) {
  return sendJson(templateVersionPath(args, operation), {}, {}, "POST");
}

export function activateMonitoringTemplate(
  args: ServiceArguments<"monitoring_templates_activate"> = {},
) {
  return setMonitoringTemplateStatus(args, "activate");
}

export function deactivateMonitoringTemplate(
  args: ServiceArguments<"monitoring_templates_deactivate"> = {},
) {
  return setMonitoringTemplateStatus(args, "deactivate");
}

export function archiveMonitoringTemplate(
  args: ServiceArguments<"monitoring_templates_archive"> = {},
) {
  return deleteJson(templateVersionPath(args));
}

export function listRuntimeMonitoringResults(
  args: ServiceArguments<"runtime_monitoring_results_list"> = {},
) {
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

export function getRuntimeMonitoringHealthSummary(
  args: ServiceArguments<"runtime_monitoring_health_summary"> = {},
) {
  return fetchJson(
    runtimeMonitoringHealthSummaryPath(args),
    cleanParams({
      observedFrom: args.observedFrom,
      observedTo: args.observedTo,
      status: args.status,
      resolution: args.resolution,
      maxPoints: args.maxPoints,
    }),
  );
}

export function createRuntimeActiveMonitor(
  args: ServiceArguments<"runtime_active_monitors_create"> = {},
) {
  return sendJson(
    activeMonitorsPath(args),
    payload(args, ["runtimeReference"]),
    {},
    "POST",
  );
}

export function updateRuntimeActiveMonitor(
  args: ServiceArguments<"runtime_active_monitors_update"> = {},
) {
  return sendJson(
    activeMonitorsPath(args, true),
    payload(args, ["runtimeReference", "monitorId"]),
    {},
    "PATCH",
  );
}

export function archiveRuntimeActiveMonitor(
  args: ServiceArguments<"runtime_active_monitors_archive"> = {},
) {
  return deleteJson(activeMonitorsPath(args, true));
}

export async function getApplicationMonitoringHealth(
  args: ServiceArguments<"applications_monitoring_health_get"> = {},
) {
  const applicationId = requiredId(args, "applicationId");
  return fetchJson(
    `/api/monitoring/applications/${segment(applicationId)}/health`,
    cleanParams({ includeConfigured: args.includeConfigured ?? false }),
  );
}

export async function listRuntimeMonitoringSignals(
  args: ServiceArguments<"runtime_monitoring_signals_list"> = {},
) {
  const runtimeReference = requiredId(args, "runtimeReference");
  return fetchJson(
    `/api/monitoring/runtimes/${segment(runtimeReference)}/signals`,
    cleanParams({
      observedFrom: args.observedFrom,
      observedTo: args.observedTo,
      status: args.status,
      page: args.page ?? 1,
      limit: args.limit ?? 50,
    }),
  );
}
