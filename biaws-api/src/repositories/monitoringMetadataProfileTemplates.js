import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { monitoringMetadataProfileCatalog } from "./monitoringMetadataProfiles.js";
import { normalizeMonitoringTemplateDefinition } from "./monitoringTemplateEvaluator.js";
import { ensureMonitoringTemplateIndexes } from "./monitoringTemplatesStorage.js";

const PROFILE_IDS = ["sgmp-health/v1", "sgmp-api-health/v1"];
const FIELD_CONTRACTS = Object.freeze({
  service_up: { type: "boolean", required: true },
  database_up: { type: "boolean", required: false },
  connection_pool_up: { type: "boolean", required: false },
  database_response_time_ms: { type: "integer", required: false, minimum: 0 },
  disk_usage_percent: {
    type: "number",
    required: false,
    minimum: 0,
    maximum: 100,
  },
  pool_utilization_percent: {
    type: "number",
    required: false,
    minimum: 0,
    maximum: 100,
  },
  pool_active_connections: { type: "integer", required: false, minimum: 0 },
  pool_idle_connections: { type: "integer", required: false, minimum: 0 },
  pool_total_connections: { type: "integer", required: false, minimum: 0 },
  pool_awaiting_threads: { type: "integer", required: false, minimum: 0 },
  pool_maximum_size: { type: "integer", required: false, minimum: 0 },
  pool_minimum_idle: { type: "integer", required: false, minimum: 0 },
  service_now_status: { type: "string", required: false },
  error_history_dates: {
    type: "array",
    required: false,
    items: "string",
    maxItems: 100,
  },
  error_history_values: {
    type: "array",
    required: false,
    items: "number",
    maxItems: 100,
  },
  error_history_unit: {
    type: "string",
    required: false,
    enum: ["bytes", "files"],
  },
});

function profileFields(profile) {
  const keys = new Set(profile.fields.map(({ key }) => key));
  for (const series of profile.series || []) {
    keys.add(series.xKey);
    keys.add(series.yKey);
    keys.add(series.yFormatKey);
  }
  return [...keys].map((key) => ({ key, ...FIELD_CONTRACTS[key] }));
}

function sampleMetadata(fields) {
  const values = {
    service_up: true,
    database_up: true,
    connection_pool_up: true,
    database_response_time_ms: 31,
    disk_usage_percent: 65,
    pool_utilization_percent: 60,
    pool_active_connections: 12,
    pool_idle_connections: 8,
    pool_total_connections: 20,
    pool_awaiting_threads: 2,
    pool_maximum_size: 20,
    pool_minimum_idle: 2,
    service_now_status: "UP",
    error_history_dates: ["2026-08-12", "2026-08-13"],
    error_history_values: [1, 0],
    error_history_unit: "files",
  };
  return Object.fromEntries(fields.map(({ key }) => [key, values[key]]));
}

function definitionFor(profile) {
  const fields = profileFields(profile);
  return normalizeMonitoringTemplateDefinition({
    schemaVersion: "1",
    input: {
      mediaType: "application/json",
      sample: {
        status: "healthy",
        message: "Monitoramento concluído.",
        metadata: sampleMetadata(fields),
      },
    },
    transformation: {
      language: "jsonata",
      expression:
        '{"status": status, "message": message, "metadata": metadata}',
    },
    output: {
      status: {
        type: "string",
        required: true,
        enum: ["healthy", "degraded", "unavailable", "unknown"],
      },
      message: { type: "string", required: false, maxLength: 2_000 },
      metadata: {
        type: "object",
        required: true,
        additionalProperties: false,
        fields,
      },
    },
    presentation: {
      label: profile.label,
      fields: profile.fields,
      series: profile.series || [],
    },
  });
}

export function integratedMonitoringTemplateSeeds() {
  const catalog = monitoringMetadataProfileCatalog();
  return PROFILE_IDS.map((profileId) => {
    const profile = catalog.find(({ id }) => id === profileId);
    const [id, legacyVersion] = profileId.split("/");
    return {
      id,
      version: legacyVersion.slice(1),
      versionNumber: Number.parseInt(legacyVersion.slice(1), 10),
      name: profile.label,
      nameKey: profile.label.toLocaleLowerCase("pt-BR"),
      description: `Template migrado do perfil integrado ${profileId}.`,
      definition: definitionFor(profile),
      status: "active",
      source: "integrated-profile-migration",
      legacyMetadataProfile: profileId,
    };
  });
}

export async function migrateIntegratedMonitoringProfiles(
  database,
  { apply = false, now = new Date(), actor = "system:migrate-monitoring" } = {},
) {
  const signals = database.collection(
    COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS,
  );
  const templates = database.collection(
    COLLECTION_NAMES.RUNTIME_MONITORING_TEMPLATES,
  );
  if (apply) await ensureMonitoringTemplateIndexes(templates);
  const workspaces = await signals
    .aggregate([
      {
        $match: {
          metadataProfile: { $in: PROFILE_IDS },
          workspaceId: { $type: "string" },
        },
      },
      {
        $group: {
          _id: "$workspaceId",
          profiles: { $addToSet: "$metadataProfile" },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  const seeds = integratedMonitoringTemplateSeeds();
  const summary = {
    eligibleWorkspaces: workspaces.length,
    existingTemplates: 0,
    templatesToCreate: 0,
    templatesCreated: 0,
  };

  for (const workspace of workspaces) {
    for (const seed of seeds) {
      const filter = {
        workspaceId: workspace._id,
        id: seed.id,
        version: seed.version,
      };
      const exists = await templates.countDocuments(filter, { limit: 1 });
      if (exists) summary.existingTemplates += 1;
      else summary.templatesToCreate += 1;
      if (!apply || exists) continue;
      const result = await templates.updateOne(
        filter,
        {
          $setOnInsert: {
            ...seed,
            workspaceId: workspace._id,
            createdAt: now,
            createdBy: actor,
            updatedAt: now,
            updatedBy: actor,
          },
        },
        { upsert: true },
      );
      summary.templatesCreated += result.upsertedCount;
    }
  }
  return summary;
}
