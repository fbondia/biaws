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

const PROFILES = new Map([
  [SGMP_HEALTH_PRESENTATION.id, SGMP_HEALTH_PRESENTATION],
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

function profileError(message) {
  return createCatalogError(
    422,
    "INVALID_MONITORING_METADATA_PROFILE",
    message,
  );
}

function validateBoolean(metadata, key, { required = false } = {}) {
  if (metadata[key] === undefined) {
    if (required) throw profileError(`${key} is required by sgmp-health/v1`);
    return;
  }
  if (typeof metadata[key] !== "boolean") {
    throw profileError(`${key} must be a boolean`);
  }
}

function validateSgmpHealth(metadata) {
  const unknown = Object.keys(metadata).filter(
    (key) => !SGMP_HEALTH_KEYS.has(key),
  );
  if (unknown.length) {
    throw profileError(
      `metadata fields are not supported by sgmp-health/v1: ${unknown.join(", ")}`,
    );
  }

  validateBoolean(metadata, "service_up", { required: true });
  validateBoolean(metadata, "database_up");

  if (metadata.disk_usage_percent !== undefined) {
    const value = metadata.disk_usage_percent;
    if (typeof value !== "number" || value < 0 || value > 100) {
      throw profileError("disk_usage_percent must be between 0 and 100");
    }
  }
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
  return profileId;
}

export function monitoringMetadataPresentation(profileId) {
  return PROFILES.get(profileId) || null;
}
