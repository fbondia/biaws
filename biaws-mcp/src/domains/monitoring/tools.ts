import { bindTool } from "../../bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../contracts.js";
import { monitoringTools as definitions } from "./schemas.js";
import {
  activateMonitoringTemplate,
  archiveMonitoringTemplate,
  archiveRuntimeActiveMonitor,
  createMonitoringTemplate,
  createMonitoringTemplateVersion,
  createRuntimeActiveMonitor,
  deactivateMonitoringTemplate,
  getApplicationMonitoringHealth,
  getMonitoringRuntimeTopology,
  getMonitoringTemplate,
  getMonitoringTemplateContract,
  getMonitoringTemplateUsage,
  getRuntimeMonitoringHealthSummary,
  listMonitoringMetadataProfiles,
  listMonitoringRuntimeTargets,
  listMonitoringTemplates,
  listRuntimeActiveMonitors,
  listRuntimeMonitoringResults,
  listRuntimeMonitoringSignals,
  previewMonitoringTemplate,
  updateRuntimeActiveMonitor,
  validateMonitoringTemplateSample,
} from "./service.js";
const handlers: Record<string, ToolHandler> = {
  monitoring_runtime_topology_get: bindTool(
    "monitoring_runtime_topology_get",
    getMonitoringRuntimeTopology,
  ),
  monitoring_runtime_targets_list: bindTool(
    "monitoring_runtime_targets_list",
    listMonitoringRuntimeTargets,
  ),
  monitoring_metadata_profiles_list: bindTool(
    "monitoring_metadata_profiles_list",
    listMonitoringMetadataProfiles,
  ),
  applications_monitoring_health_get: bindTool(
    "applications_monitoring_health_get",
    getApplicationMonitoringHealth,
  ),
  runtime_monitoring_signals_list: bindTool(
    "runtime_monitoring_signals_list",
    listRuntimeMonitoringSignals,
  ),
  monitoring_templates_list: bindTool(
    "monitoring_templates_list",
    listMonitoringTemplates,
  ),
  monitoring_templates_get: bindTool(
    "monitoring_templates_get",
    getMonitoringTemplate,
  ),
  monitoring_templates_preview: bindTool(
    "monitoring_templates_preview",
    previewMonitoringTemplate,
  ),
  monitoring_templates_create: bindTool(
    "monitoring_templates_create",
    createMonitoringTemplate,
  ),
  monitoring_templates_create_version: bindTool(
    "monitoring_templates_create_version",
    createMonitoringTemplateVersion,
  ),
  monitoring_templates_get_usage: bindTool(
    "monitoring_templates_get_usage",
    getMonitoringTemplateUsage,
  ),
  monitoring_templates_get_contract: bindTool(
    "monitoring_templates_get_contract",
    getMonitoringTemplateContract,
  ),
  monitoring_templates_validate: bindTool(
    "monitoring_templates_validate",
    validateMonitoringTemplateSample,
  ),
  monitoring_templates_activate: bindTool(
    "monitoring_templates_activate",
    activateMonitoringTemplate,
  ),
  monitoring_templates_deactivate: bindTool(
    "monitoring_templates_deactivate",
    deactivateMonitoringTemplate,
  ),
  monitoring_templates_archive: bindTool(
    "monitoring_templates_archive",
    archiveMonitoringTemplate,
  ),
  runtime_monitoring_results_list: bindTool(
    "runtime_monitoring_results_list",
    listRuntimeMonitoringResults,
  ),
  runtime_monitoring_health_summary: bindTool(
    "runtime_monitoring_health_summary",
    getRuntimeMonitoringHealthSummary,
  ),
  runtime_active_monitors_list: bindTool(
    "runtime_active_monitors_list",
    listRuntimeActiveMonitors,
  ),
  runtime_active_monitors_create: bindTool(
    "runtime_active_monitors_create",
    createRuntimeActiveMonitor,
  ),
  runtime_active_monitors_update: bindTool(
    "runtime_active_monitors_update",
    updateRuntimeActiveMonitor,
  ),
  runtime_active_monitors_archive: bindTool(
    "runtime_active_monitors_archive",
    archiveRuntimeActiveMonitor,
  ),
};
export const monitoringTools: (ToolDefinition & { handler: ToolHandler })[] =
  definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
