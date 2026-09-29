import type {
  ActiveMonitorDocument,
  MonitorTemplateRef,
} from "../../../types/monitoring.js";
import { normalizeMonitoringPayload } from "../events/payload.js";
import {
  assertAllowedFields,
  normalizeEnum,
  optionalText,
  requiredText,
} from "../../shared/topology/normalization.js";
import { createCatalogError } from "../../shared/topology/errors.js";

export const ACTIVE_MONITOR_PROVIDERS = Object.freeze(["rest", "shell"]);

export const SHELL_FAILURE_STATUSES = Object.freeze([
  "unknown",
  "degraded",
  "unavailable",
]);

export const SHELL_CAPTURE_OUTPUTS = Object.freeze([
  "none",
  "stdout",
  "stderr",
  "both",
]);

export const MAX_ACTIVE_MONITORS_PER_RUNTIME = 50;

const MIN_INTERVAL_SECONDS = 10;

const MAX_INTERVAL_SECONDS = 86_400;

const MIN_TIMEOUT_SECONDS = 1;

const MAX_TIMEOUT_SECONDS = 300;

const MAX_EXECUTOR_BATCH = 25;

const MIN_LEASE_SECONDS = 10;

const MAX_LEASE_SECONDS = 300;

function normalizeBoolean(value: unknown, field: string, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw createCatalogError(
      422,
      "INVALID_ACTIVE_MONITOR",
      `${field} must be a boolean`,
    );
  }
  return value;
}

function normalizeInteger(
  value: unknown,
  field: string,
  { fallback, min, max }: { fallback: number; min: number; max: number },
) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw createCatalogError(
      422,
      "INVALID_ACTIVE_MONITOR",
      `${field} must be an integer between ${min} and ${max}`,
    );
  }
  return number;
}

function normalizeConfiguration(
  value: unknown,
  current: Record<string, unknown> = {},
) {
  const normalized = normalizeMonitoringPayload(
    value === undefined ? current : value,
  );
  if (
    !normalized ||
    typeof normalized !== "object" ||
    Array.isArray(normalized)
  ) {
    throw createCatalogError(
      422,
      "INVALID_ACTIVE_MONITOR",
      "configuration must be an object",
    );
  }
  return normalized;
}

function normalizeShellConfiguration(configuration: unknown) {
  assertAllowedFields(
    configuration,
    ["scriptId", "arguments", "environment", "failureStatus", "captureOutput"],
    "shell monitor configuration",
  );
  return {
    ...configuration,
    failureStatus: normalizeEnum(
      configuration.failureStatus,
      "configuration.failureStatus",
      SHELL_FAILURE_STATUSES,
      "unavailable",
    ),
    captureOutput: normalizeEnum(
      configuration.captureOutput,
      "configuration.captureOutput",
      SHELL_CAPTURE_OUTPUTS,
      "none",
    ),
  };
}

function normalizeTemplateRef(
  value: unknown,
  current: MonitorTemplateRef | null = null,
) {
  if (value === undefined) return current;
  if (value === null || value === "") return null;
  assertAllowedFields(
    value,
    ["id", "version"],
    "monitoring template reference",
  );
  return {
    id: requiredText(value.id, "templateRef.id", 100),
    version: requiredText(value.version, "templateRef.version", 40),
  };
}

export function normalizeActiveMonitorInput(
  payload: Record<string, unknown> = {},
  current: Partial<ActiveMonitorDocument> | null = null,
) {
  assertAllowedFields(
    payload,
    [
      "name",
      "description",
      "provider",
      "enabled",
      "intervalSeconds",
      "timeoutSeconds",
      "configuration",
      "templateRef",
    ],
    "active monitor",
  );
  const intervalSeconds = normalizeInteger(
    payload.intervalSeconds,
    "intervalSeconds",
    {
      fallback: current?.intervalSeconds ?? 60,
      min: MIN_INTERVAL_SECONDS,
      max: MAX_INTERVAL_SECONDS,
    },
  );
  const timeoutSeconds = normalizeInteger(
    payload.timeoutSeconds,
    "timeoutSeconds",
    {
      fallback: current?.timeoutSeconds ?? 10,
      min: MIN_TIMEOUT_SECONDS,
      max: Math.min(MAX_TIMEOUT_SECONDS, intervalSeconds),
    },
  );
  const name = requiredText(payload.name ?? current?.name, "name", 160);
  const provider = normalizeEnum(
    payload.provider,
    "provider",
    ACTIVE_MONITOR_PROVIDERS,
    current?.provider,
  );
  const configuration = normalizeConfiguration(
    payload.configuration,
    current?.configuration || {},
  );
  const templateRef = normalizeTemplateRef(
    payload.templateRef,
    current?.templateRef,
  );
  if (provider === "shell" && templateRef) {
    throw createCatalogError(
      422,
      "SHELL_TEMPLATE_NOT_SUPPORTED",
      "Shell monitors do not support templateRef; remove the template reference before saving",
    );
  }
  return {
    name,
    nameKey: name.toLocaleLowerCase("pt-BR"),
    description: optionalText(
      payload.description ?? current?.description,
      "description",
      2_000,
    ),
    provider,
    enabled: normalizeBoolean(
      payload.enabled,
      "enabled",
      current?.enabled ?? true,
    ),
    intervalSeconds,
    timeoutSeconds,
    configuration:
      provider === "shell"
        ? normalizeShellConfiguration(configuration)
        : configuration,
    templateRef,
  };
}

export function normalizeActiveMonitorLeaseRequest(
  payload: Record<string, unknown> = {},
) {
  assertAllowedFields(
    payload,
    ["executorId", "limit", "leaseSeconds"],
    "active monitor lease",
  );
  return {
    executorId: requiredText(payload.executorId, "executorId", 160),
    limit: normalizeInteger(payload.limit, "limit", {
      fallback: 1,
      min: 1,
      max: MAX_EXECUTOR_BATCH,
    }),
    leaseSeconds: normalizeInteger(payload.leaseSeconds, "leaseSeconds", {
      fallback: 60,
      min: MIN_LEASE_SECONDS,
      max: MAX_LEASE_SECONDS,
    }),
  };
}
