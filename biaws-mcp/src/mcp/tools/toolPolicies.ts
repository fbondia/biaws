import type { ToolName } from "./contracts.js";

export interface ToolPolicy {
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean };
  availability: "all" | "stdio";
  reason: string;
}
const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const append = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const mutate = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
const monitor = { readOnlyHint: false, destructiveHint: true, openWorldHint: true };
const monitorCreate = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

// Explicit exhaustive review: adding a tool requires a policy and justification.
// Hints describe effects; authorization remains enforced by the API.
export const toolPolicies = {
  applications_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  applications_get_context: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  components_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  integrations_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  repositories_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  servers_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  deployments_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  runtimes_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  applications_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  applications_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  components_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  components_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  integrations_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  integrations_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  repositories_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  repositories_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  servers_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  servers_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  deployments_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  deployments_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  deployments_record_publication: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  runtimes_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  runtimes_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  resource_collections_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  resource_collections_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  resource_collections_delete: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  applications_move_to_collection: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  servers_move_to_collection: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  secrets_move_to_collection: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  skills_move_to_collection: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_move_to_collection: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  documents_move_to_collection: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  secrets_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  secrets_register: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  knowledge_context_load: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  document_types_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  documents_search: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  documents_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  documents_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  documents_add_observation: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  attachments_upload: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  attachments_download: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  attachments_update_tags: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  attachments_delete: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_update_specification: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_update_checklist: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_update_journeys: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_update_note: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_delete_note: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  demands_get: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  demands_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  demands_journey_calendar: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  demands_deadlines: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  demands_implementation_context: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  demands_add_note: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  demands_update_description: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_list_tasks: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  demands_create_task: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  demands_update_task: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_update_task_status: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_delete_task: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_add_task_note: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  demands_update_task_note: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  demands_delete_task_note: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  audit_events_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  applications_monitoring_health_get: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  runtime_monitoring_signals_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  monitoring_templates_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  monitoring_templates_preview: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  monitoring_templates_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  monitoring_templates_create_version: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  monitoring_templates_validate: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  monitoring_templates_activate: {
    annotations: monitor,
    availability: "all",
    reason: "Changes monitor execution/configuration; the executor may contact configured external targets.",
  },
  monitoring_templates_deactivate: {
    annotations: monitor,
    availability: "all",
    reason: "Changes monitor execution/configuration; the executor may contact configured external targets.",
  },
  monitoring_templates_archive: {
    annotations: monitor,
    availability: "all",
    reason: "Changes monitor execution/configuration; the executor may contact configured external targets.",
  },
  runtime_monitoring_results_list: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  runtime_monitoring_health_summary: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  runtime_active_monitors_create: {
    annotations: monitorCreate,
    availability: "all",
    reason: "Changes monitor execution/configuration; the executor may contact configured external targets.",
  },
  runtime_active_monitors_update: {
    annotations: monitor,
    availability: "all",
    reason: "Changes monitor execution/configuration; the executor may contact configured external targets.",
  },
  runtime_active_monitors_archive: {
    annotations: monitor,
    availability: "all",
    reason: "Changes monitor execution/configuration; the executor may contact configured external targets.",
  },
  issues_search: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  issues_get: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  issues_update: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  issues_add_comment: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  issues_update_comment: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  issues_delete_comment: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  issues_get_classification_catalog: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  issues_create_taxonomy_item: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  issues_update_taxonomy_item: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  issues_summary: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  issues_aggregate: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  issues_create: {
    annotations: append,
    availability: "all",
    reason: "Adds a record or evidence without replacing existing content.",
  },
  issues_import_eml: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  issues_analyze_eml_file: {
    annotations: read,
    availability: "stdio",
    reason:
      "Reads or evaluates existing workspace data without changing domain state. Requires an approved local EML file and local filesystem access.",
  },
  issues_import_eml_file: {
    annotations: mutate,
    availability: "stdio",
    reason:
      "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content. Requires an approved local EML file and local filesystem access.",
  },
  issues_update_state: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  issues_suggest_taxonomy: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
  issues_classify: {
    annotations: mutate,
    availability: "all",
    reason: "Changes, replaces, moves, archives or deletes existing workspace state; may discard prior content.",
  },
  issues_by_taxonomy: {
    annotations: read,
    availability: "all",
    reason: "Reads or evaluates existing workspace data without changing domain state.",
  },
} satisfies Record<ToolName, ToolPolicy>;
