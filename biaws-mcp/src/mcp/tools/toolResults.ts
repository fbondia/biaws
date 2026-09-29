import type {
  deleteAttachment,
  downloadAttachment,
  updateAttachmentTags,
  uploadAttachments,
} from "../../domains/attachments/service.js";
import type { listAuditEvents } from "../../domains/audit/service.js";
import type {
  createApplication,
  createComponent,
  createDeployment,
  createIntegration,
  createRepository,
  createRuntime,
  createServer,
  getApplicationContext,
  listApplications,
  listComponents,
  listDeployments,
  listIntegrations,
  listRepositories,
  listRuntimes,
  listServers,
  recordDeploymentPublication,
  updateApplication,
  updateComponent,
  updateDeployment,
  updateIntegration,
  updateRepository,
  updateRuntime,
  updateServer,
} from "../../domains/catalog/service.js";
import type {
  createResourceCollection,
  deleteResourceCollection,
  moveApplicationToCollection,
  moveDemandToCollection,
  moveDocumentToCollection,
  moveSecretToCollection,
  moveServerToCollection,
  moveSkillToCollection,
  updateResourceCollection,
} from "../../domains/collections/service.js";
import type {
  addDemandNote,
  addDemandTaskNote,
  createDemand,
  createDemandTask,
  deleteDemandNote,
  deleteDemandTask,
  deleteDemandTaskNote,
  getDemand,
  getDemandDeadlines,
  getDemandImplementationContext,
  getJourneyCalendar,
  listDemands,
  listDemandTasks,
  updateDemand,
  updateDemandChecklist,
  updateDemandDescription,
  updateDemandJourneys,
  updateDemandNote,
  updateDemandSpecification,
  updateDemandTask,
  updateDemandTaskNote,
  updateDemandTaskStatus,
} from "../../domains/demands/service.js";
import type {
  addIssueComment,
  classifyIssue,
  createIssue,
  createTaxonomyItem,
  findIssuesByTaxonomy,
  getIssueClassificationCatalog,
  getIssueDetails,
  importEml,
  searchIssues,
  suggestTaxonomy,
  summarizeIssuesForSupport,
  updateIssue,
  updateIssueComment,
  updateIssueState,
  updateTaxonomyItem,
} from "../../domains/issues/service.js";
import type {
  addDocumentObservation,
  createDocument,
  listDocumentTypes,
  loadKnowledgeContext,
  searchDocuments,
  updateDocument,
} from "../../domains/knowledge/service.js";
import type {
  activateMonitoringTemplate,
  archiveMonitoringTemplate,
  archiveRuntimeActiveMonitor,
  createMonitoringTemplate,
  createMonitoringTemplateVersion,
  createRuntimeActiveMonitor,
  deactivateMonitoringTemplate,
  getApplicationMonitoringHealth,
  getRuntimeMonitoringHealthSummary,
  listMonitoringTemplates,
  listRuntimeMonitoringResults,
  listRuntimeMonitoringSignals,
  previewMonitoringTemplate,
  updateRuntimeActiveMonitor,
  validateMonitoringTemplateSample,
} from "../../domains/monitoring/service.js";
import type {
  listSecretMetadata,
  registerSecretMetadata,
} from "../../domains/secrets/service.js";
export interface ToolResultMap {
  issues_search: Awaited<ReturnType<typeof searchIssues>>;
  issues_get: Awaited<ReturnType<typeof getIssueDetails>>;
  issues_update: Awaited<ReturnType<typeof updateIssue>>;
  issues_add_comment: Awaited<ReturnType<typeof addIssueComment>>;
  issues_update_comment: Awaited<ReturnType<typeof updateIssueComment>>;
  issues_get_classification_catalog: Awaited<
    ReturnType<typeof getIssueClassificationCatalog>
  >;
  issues_create_taxonomy_item: Awaited<ReturnType<typeof createTaxonomyItem>>;
  issues_update_taxonomy_item: Awaited<ReturnType<typeof updateTaxonomyItem>>;
  issues_summary: Awaited<ReturnType<typeof summarizeIssuesForSupport>>;
  issues_aggregate: Awaited<ReturnType<typeof summarizeIssuesForSupport>>;
  issues_create: Awaited<ReturnType<typeof createIssue>>;
  issues_import_eml: Awaited<ReturnType<typeof importEml>>;
  issues_update_state: Awaited<ReturnType<typeof updateIssueState>>;
  issues_suggest_taxonomy: Awaited<ReturnType<typeof suggestTaxonomy>>;
  issues_classify: Awaited<ReturnType<typeof classifyIssue>>;
  issues_by_taxonomy: Awaited<ReturnType<typeof findIssuesByTaxonomy>>;
  demands_list: Awaited<ReturnType<typeof listDemands>>;
  demands_get: Awaited<ReturnType<typeof getDemand>>;
  demands_create: Awaited<ReturnType<typeof createDemand>>;
  demands_journey_calendar: Awaited<ReturnType<typeof getJourneyCalendar>>;
  demands_deadlines: Awaited<ReturnType<typeof getDemandDeadlines>>;
  demands_implementation_context: Awaited<
    ReturnType<typeof getDemandImplementationContext>
  >;
  demands_add_note: Awaited<ReturnType<typeof addDemandNote>>;
  demands_update_description: Awaited<
    ReturnType<typeof updateDemandDescription>
  >;
  demands_list_tasks: Awaited<ReturnType<typeof listDemandTasks>>;
  demands_create_task: Awaited<ReturnType<typeof createDemandTask>>;
  demands_update_task: Awaited<ReturnType<typeof updateDemandTask>>;
  demands_update_task_status: Awaited<
    ReturnType<typeof updateDemandTaskStatus>
  >;
  demands_delete_task: Awaited<ReturnType<typeof deleteDemandTask>>;
  demands_add_task_note: Awaited<ReturnType<typeof addDemandTaskNote>>;
  demands_update_task_note: Awaited<ReturnType<typeof updateDemandTaskNote>>;
  demands_delete_task_note: Awaited<ReturnType<typeof deleteDemandTaskNote>>;
  attachments_upload: Awaited<ReturnType<typeof uploadAttachments>>;
  attachments_download: Awaited<ReturnType<typeof downloadAttachment>>;
  attachments_update_tags: Awaited<ReturnType<typeof updateAttachmentTags>>;
  attachments_delete: Awaited<ReturnType<typeof deleteAttachment>>;
  audit_events_list: Awaited<ReturnType<typeof listAuditEvents>>;

  applications_list: Awaited<ReturnType<typeof listApplications>>;

  applications_get_context: Awaited<ReturnType<typeof getApplicationContext>>;
  components_list: Awaited<ReturnType<typeof listComponents>>;

  integrations_list: Awaited<ReturnType<typeof listIntegrations>>;

  repositories_list: Awaited<ReturnType<typeof listRepositories>>;

  servers_list: Awaited<ReturnType<typeof listServers>>;

  deployments_list: Awaited<ReturnType<typeof listDeployments>>;

  runtimes_list: Awaited<ReturnType<typeof listRuntimes>>;

  applications_create: Awaited<ReturnType<typeof createApplication>>;
  applications_update: Awaited<ReturnType<typeof updateApplication>>;
  components_create: Awaited<ReturnType<typeof createComponent>>;
  components_update: Awaited<ReturnType<typeof updateComponent>>;
  integrations_create: Awaited<ReturnType<typeof createIntegration>>;
  integrations_update: Awaited<ReturnType<typeof updateIntegration>>;
  repositories_create: Awaited<ReturnType<typeof createRepository>>;
  repositories_update: Awaited<ReturnType<typeof updateRepository>>;
  servers_create: Awaited<ReturnType<typeof createServer>>;
  servers_update: Awaited<ReturnType<typeof updateServer>>;
  deployments_create: Awaited<ReturnType<typeof createDeployment>>;
  deployments_update: Awaited<ReturnType<typeof updateDeployment>>;
  deployments_record_publication: Awaited<
    ReturnType<typeof recordDeploymentPublication>
  >;
  runtimes_create: Awaited<ReturnType<typeof createRuntime>>;
  runtimes_update: Awaited<ReturnType<typeof updateRuntime>>;

  resource_collections_create: Awaited<
    ReturnType<typeof createResourceCollection>
  >;
  resource_collections_update: Awaited<
    ReturnType<typeof updateResourceCollection>
  >;
  resource_collections_delete: Awaited<
    ReturnType<typeof deleteResourceCollection>
  >;
  applications_move_to_collection: Awaited<
    ReturnType<typeof moveApplicationToCollection>
  >;
  servers_move_to_collection: Awaited<
    ReturnType<typeof moveServerToCollection>
  >;
  secrets_move_to_collection: Awaited<
    ReturnType<typeof moveSecretToCollection>
  >;
  skills_move_to_collection: Awaited<ReturnType<typeof moveSkillToCollection>>;
  demands_move_to_collection: Awaited<
    ReturnType<typeof moveDemandToCollection>
  >;
  documents_move_to_collection: Awaited<
    ReturnType<typeof moveDocumentToCollection>
  >;
  demands_update: Awaited<ReturnType<typeof updateDemand>>;
  demands_update_specification: Awaited<
    ReturnType<typeof updateDemandSpecification>
  >;
  demands_update_checklist: Awaited<ReturnType<typeof updateDemandChecklist>>;
  demands_update_journeys: Awaited<ReturnType<typeof updateDemandJourneys>>;
  demands_update_note: Awaited<ReturnType<typeof updateDemandNote>>;
  demands_delete_note: Awaited<ReturnType<typeof deleteDemandNote>>;
  knowledge_context_load: Awaited<ReturnType<typeof loadKnowledgeContext>>;
  document_types_list: Awaited<ReturnType<typeof listDocumentTypes>>;
  documents_search: Awaited<ReturnType<typeof searchDocuments>>;

  documents_create: Awaited<ReturnType<typeof createDocument>>;
  documents_update: Awaited<ReturnType<typeof updateDocument>>;
  documents_add_observation: Awaited<ReturnType<typeof addDocumentObservation>>;

  applications_monitoring_health_get: Awaited<
    ReturnType<typeof getApplicationMonitoringHealth>
  >;
  runtime_monitoring_signals_list: Awaited<
    ReturnType<typeof listRuntimeMonitoringSignals>
  >;
  monitoring_templates_list: Awaited<
    ReturnType<typeof listMonitoringTemplates>
  >;

  monitoring_templates_preview: Awaited<
    ReturnType<typeof previewMonitoringTemplate>
  >;
  monitoring_templates_create: Awaited<
    ReturnType<typeof createMonitoringTemplate>
  >;
  monitoring_templates_create_version: Awaited<
    ReturnType<typeof createMonitoringTemplateVersion>
  >;

  monitoring_templates_validate: Awaited<
    ReturnType<typeof validateMonitoringTemplateSample>
  >;
  monitoring_templates_activate: Awaited<
    ReturnType<typeof activateMonitoringTemplate>
  >;
  monitoring_templates_deactivate: Awaited<
    ReturnType<typeof deactivateMonitoringTemplate>
  >;
  monitoring_templates_archive: Awaited<
    ReturnType<typeof archiveMonitoringTemplate>
  >;
  runtime_monitoring_results_list: Awaited<
    ReturnType<typeof listRuntimeMonitoringResults>
  >;
  runtime_monitoring_health_summary: Awaited<
    ReturnType<typeof getRuntimeMonitoringHealthSummary>
  >;

  runtime_active_monitors_create: Awaited<
    ReturnType<typeof createRuntimeActiveMonitor>
  >;
  runtime_active_monitors_update: Awaited<
    ReturnType<typeof updateRuntimeActiveMonitor>
  >;
  runtime_active_monitors_archive: Awaited<
    ReturnType<typeof archiveRuntimeActiveMonitor>
  >;
  secrets_list: Awaited<ReturnType<typeof listSecretMetadata>>;

  secrets_register: Awaited<ReturnType<typeof registerSecretMetadata>>;
}
