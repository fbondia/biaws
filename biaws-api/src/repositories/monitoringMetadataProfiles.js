import { createCatalogError } from "./topologyRepositorySupport.js";

const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}\/v[1-9][0-9]{0,5}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const SGMP_HEALTH_PRESENTATION = Object.freeze({
  id: "sgmp-health/v1",
  label: "Saúde do SGMP",
  fields: [
    {
      key: "service_up",
      label: "Serviço",
      format: "status",
      visualization: "badge",
    },
    {
      key: "database_up",
      label: "Banco de dados",
      format: "status",
      visualization: "badge",
    },
    {
      key: "disk_usage_percent",
      label: "Consumo de disco",
      format: "percent",
      visualization: "gauge",
    },
    {
      key: "service_now_status",
      label: "Integração ServiceNow",
      format: "status",
      visualization: "badge",
    },
  ],
  series: [
    {
      label: "Volume de erros",
      visualization: "line",
      xKey: "error_history_dates",
      xFormat: "date",
      yKey: "error_history_values",
      yFormatKey: "error_history_unit",
    },
  ],
});

const SGMP_API_HEALTH_PRESENTATION = Object.freeze({
  id: "sgmp-api-health/v1",
  label: "Saúde da API de Automações",
  fields: [
    {
      key: "service_up",
      label: "Serviço",
      format: "status",
      visualization: "badge",
    },
    {
      key: "database_up",
      label: "Banco de dados",
      format: "status",
      visualization: "badge",
    },
    {
      key: "connection_pool_up",
      label: "Pool de conexões",
      format: "status",
      visualization: "badge",
    },
    {
      key: "database_response_time_ms",
      label: "Tempo do banco (ms)",
      format: "number",
      visualization: "value",
    },
    {
      key: "pool_utilization_percent",
      label: "Utilização do pool",
      format: "percent",
      visualization: "gauge",
    },
    {
      key: "pool_active_connections",
      label: "Conexões ativas",
      format: "number",
      visualization: "value",
    },
    {
      key: "pool_idle_connections",
      label: "Conexões ociosas",
      format: "number",
      visualization: "value",
    },
    {
      key: "pool_total_connections",
      label: "Total de conexões",
      format: "number",
      visualization: "value",
    },
    {
      key: "pool_awaiting_threads",
      label: "Threads aguardando conexão",
      format: "number",
      visualization: "value",
    },
    {
      key: "pool_maximum_size",
      label: "Limite do pool",
      format: "number",
      visualization: "value",
    },
    {
      key: "pool_minimum_idle",
      label: "Mínimo ocioso",
      format: "number",
      visualization: "value",
    },
    {
      key: "disk_usage_percent",
      label: "Consumo de disco",
      format: "percent",
      visualization: "gauge",
    },
  ],
  series: SGMP_HEALTH_PRESENTATION.series,
});

const PROFILES = new Map([
  [SGMP_HEALTH_PRESENTATION.id, SGMP_HEALTH_PRESENTATION],
  [SGMP_API_HEALTH_PRESENTATION.id, SGMP_API_HEALTH_PRESENTATION],
]);
const SGMP_HEALTH_KEYS = new Set([
  "service_up",
  "database_up",
  "disk_usage_percent",
  "service_now_status",
  "error_history_dates",
  "error_history_values",
  "error_history_unit",
]);
const SGMP_API_HEALTH_KEYS = new Set([
  ...SGMP_HEALTH_KEYS,
  "connection_pool_up",
  "database_response_time_ms",
  "pool_active_connections",
  "pool_idle_connections",
  "pool_total_connections",
  "pool_awaiting_threads",
  "pool_maximum_size",
  "pool_minimum_idle",
  "pool_utilization_percent",
]);

function profileError(message) {
  return createCatalogError(
    422,
    "INVALID_MONITORING_METADATA_PROFILE",
    message,
  );
}

function validateBoolean(
  metadata,
  key,
  { required = false, profileId = SGMP_HEALTH_PRESENTATION.id } = {},
) {
  if (metadata[key] === undefined) {
    if (required) throw profileError(`${key} is required by ${profileId}`);
    return;
  }
  if (typeof metadata[key] !== "boolean") {
    throw profileError(`${key} must be a boolean`);
  }
}

function validateNonNegativeInteger(metadata, key) {
  if (metadata[key] === undefined) return;
  if (!Number.isInteger(metadata[key]) || metadata[key] < 0) {
    throw profileError(`${key} must be a non-negative integer`);
  }
}

function validatePercent(metadata, key) {
  if (metadata[key] === undefined) return;
  const value = metadata[key];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    throw profileError(`${key} must be between 0 and 100`);
  }
}

function validateSgmpHealth(
  metadata,
  {
    profileId = SGMP_HEALTH_PRESENTATION.id,
    allowedKeys = SGMP_HEALTH_KEYS,
  } = {},
) {
  const unknown = Object.keys(metadata).filter((key) => !allowedKeys.has(key));
  if (unknown.length) {
    throw profileError(
      `metadata fields are not supported by ${profileId}: ${unknown.join(", ")}`,
    );
  }

  validateBoolean(metadata, "service_up", { required: true, profileId });
  validateBoolean(metadata, "database_up", { profileId });

  validatePercent(metadata, "disk_usage_percent");
  if (
    metadata.service_now_status !== undefined &&
    (typeof metadata.service_now_status !== "string" ||
      !metadata.service_now_status.trim())
  ) {
    throw profileError("service_now_status must be a non-empty string");
  }

  const historyKeys = [
    "error_history_dates",
    "error_history_values",
    "error_history_unit",
  ];
  const historyFields = historyKeys.filter(
    (key) => metadata[key] !== undefined,
  );
  if (historyFields.length && historyFields.length !== historyKeys.length) {
    throw profileError(
      "error history requires dates, values and unit together",
    );
  }
  if (!historyFields.length) return;

  const dates = metadata.error_history_dates;
  const values = metadata.error_history_values;
  if (
    !Array.isArray(dates) ||
    !dates.every((date) => {
      if (typeof date !== "string" || !DATE_PATTERN.test(date)) return false;
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
      );
    })
  ) {
    throw profileError("error_history_dates must contain ISO dates");
  }
  if (
    !Array.isArray(values) ||
    !values.every(
      (value) =>
        typeof value === "number" && Number.isFinite(value) && value >= 0,
    )
  ) {
    throw profileError(
      "error_history_values must contain non-negative numbers",
    );
  }
  if (dates.length !== values.length) {
    throw profileError("error history dates and values must have equal length");
  }
  if (!["bytes", "files"].includes(metadata.error_history_unit)) {
    throw profileError("error_history_unit must be bytes or files");
  }
}

function validateSgmpApiHealth(metadata) {
  validateSgmpHealth(metadata, {
    profileId: SGMP_API_HEALTH_PRESENTATION.id,
    allowedKeys: SGMP_API_HEALTH_KEYS,
  });
  validateBoolean(metadata, "connection_pool_up", {
    profileId: SGMP_API_HEALTH_PRESENTATION.id,
  });
  validatePercent(metadata, "pool_utilization_percent");
  [
    "database_response_time_ms",
    "pool_active_connections",
    "pool_idle_connections",
    "pool_total_connections",
    "pool_awaiting_threads",
    "pool_maximum_size",
    "pool_minimum_idle",
  ].forEach((key) => validateNonNegativeInteger(metadata, key));
}

export function normalizeMonitoringMetadataProfile(value, metadata) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw profileError("metadataProfile must be a string");
  }
  const profileId = value.trim();
  if (!PROFILE_ID_PATTERN.test(profileId)) {
    throw profileError("metadataProfile must use the name/vN format");
  }
  if (!PROFILES.has(profileId)) {
    throw profileError(`unknown metadataProfile: ${profileId}`);
  }
  if (profileId === SGMP_HEALTH_PRESENTATION.id) validateSgmpHealth(metadata);
  if (profileId === SGMP_API_HEALTH_PRESENTATION.id) {
    validateSgmpApiHealth(metadata);
  }
  return profileId;
}

export function monitoringMetadataPresentation(profileId) {
  return PROFILES.get(profileId) || null;
}
