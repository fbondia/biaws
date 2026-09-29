import {
  CATALOG_LIMITS,
  REPOSITORY_PROVIDERS,
  REPOSITORY_SYNC_MODES,
  REPOSITORY_SYNC_STATES,
} from "../../../../shared/index.js";
import {
  assertAllowedFields,
  normalizeDate,
  normalizeEnum,
  normalizeHttpUrl,
  normalizeKey,
  optionalText,
  requiredText,
} from "../shared/topology/normalization.js";
import { createCatalogError } from "../shared/topology/errors.js";

function normalizeSync(value, current = {}) {
  if (value === undefined) {
    return {
      mode: current.mode || "manual",
      lastSyncedAt: current.lastSyncedAt ?? null,
      state: current.state || "never",
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createCatalogError(
      422,
      "INVALID_REPOSITORY_SYNC",
      "sync must be an object",
    );
  }
  assertAllowedFields(value, ["mode", "lastSyncedAt", "state"], "sync");
  return {
    mode: normalizeEnum(
      value.mode,
      "sync.mode",
      REPOSITORY_SYNC_MODES,
      current.mode || "manual",
    ),
    lastSyncedAt: normalizeDate(
      value.lastSyncedAt,
      "sync.lastSyncedAt",
      current.lastSyncedAt,
    ),
    state: normalizeEnum(
      value.state,
      "sync.state",
      REPOSITORY_SYNC_STATES,
      current.state || "never",
    ),
  };
}

export function normalizeRepositoryInput(payload = {}, current = null) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "description",
      "provider",
      "organization",
      "url",
      "defaultBranch",
      "sync",
    ],
    "repository",
  );
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(
      payload.name ?? current?.name,
      "name",
      CATALOG_LIMITS.name,
    ),
    description: optionalText(
      payload.description ?? current?.description,
      "description",
      CATALOG_LIMITS.description,
    ),
    provider: normalizeEnum(
      payload.provider,
      "provider",
      REPOSITORY_PROVIDERS,
      current?.provider || "other",
    ),
    organization: optionalText(
      payload.organization ?? current?.organization,
      "organization",
      CATALOG_LIMITS.organization,
    ),
    url: normalizeHttpUrl(payload.url, "url", {
      required: true,
      current: current?.url,
    }),
    defaultBranch: optionalText(
      payload.defaultBranch ?? current?.defaultBranch,
      "defaultBranch",
      CATALOG_LIMITS.branch,
    ),
    sync: normalizeSync(payload.sync, current?.sync),
  };
}
