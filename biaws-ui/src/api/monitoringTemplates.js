import { deleteJson, fetchJson, sendJson } from "./client.js";

const base = "/api/monitoring/templates";

export const fetchMonitoringTemplates = (params) => fetchJson(base, params);
export const fetchMonitoringMetadataProfiles = () =>
  fetchJson("/api/monitoring/metadata-profiles");
export const fetchMonitoringTemplate = (templateId, params) =>
  fetchJson(`${base}/${encodeURIComponent(templateId)}`, params);
export const createMonitoringTemplate = (template) =>
  sendJson(base, template, undefined, "POST");
export const createMonitoringTemplateVersion = (templateId, template) =>
  sendJson(
    `${base}/${encodeURIComponent(templateId)}`,
    template,
    undefined,
    "PATCH",
  );
export const previewMonitoringTemplate = (payload) =>
  sendJson(`${base}/preview`, payload, undefined, "POST");
export const setMonitoringTemplateActive = (templateId, version, active) =>
  sendJson(
    `${base}/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}/${active ? "activate" : "deactivate"}`,
    {},
    undefined,
    "POST",
  );
export const fetchMonitoringTemplateUsage = (templateId, version) =>
  fetchJson(
    `${base}/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}/usage`,
  );
export const deleteMonitoringTemplateVersion = (templateId, version) =>
  deleteJson(
    `${base}/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}`,
  );
