export const DEFAULT_WORKSPACE_KEY = "default";
export const DEFAULT_WORKSPACE_NAME = "Bondia Workspaces";
export const DEFAULT_MONITORING_RETENTION_DAYS = 10;

export const WORKSPACE_STATUSES = Object.freeze(["active", "archived"]);
export const APPLICATION_STATUSES = Object.freeze(["active", "archived"]);
export const COMPONENT_STATUSES = Object.freeze(["active", "archived"]);
export const COMPONENT_TYPES = Object.freeze([
  "api",
  "ui",
  "worker",
  "service",
  "library",
  "integration",
  "other",
]);
export const REPOSITORY_STATUSES = Object.freeze(["active", "archived"]);
export const REPOSITORY_PROVIDERS = Object.freeze([
  "github",
  "gitlab",
  "bitbucket",
  "azure-devops",
  "local",
  "other",
]);
export const REPOSITORY_LINK_ROLES = Object.freeze([
  "source",
  "configuration",
  "infrastructure",
  "documentation",
  "other",
]);
export const REPOSITORY_SYNC_MODES = Object.freeze(["manual", "connector"]);
export const REPOSITORY_SYNC_STATES = Object.freeze([
  "never",
  "pending",
  "synchronized",
  "failed",
]);
export const SERVER_STATUSES = Object.freeze([
  "active",
  "maintenance",
  "retired",
  "archived",
]);
export const DEPLOYMENT_ENVIRONMENTS = Object.freeze([
  "development",
  "test",
  "staging",
  "production",
  "other",
]);
export const DEPLOYMENT_STATUSES = Object.freeze([
  "planned",
  "deploying",
  "active",
  "inactive",
  "failed",
  "archived",
]);
export const RUNTIME_KINDS = Object.freeze([
  "process",
  "container",
  "kubernetes",
  "serverless",
  "managed",
  "external",
  "other",
]);
export const RUNTIME_STATUSES = Object.freeze([
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
  "stopped",
  "archived",
]);

export const CATALOG_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const CATALOG_METADATA_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,79}$/u;

export const CATALOG_LIMITS = Object.freeze({
  key: 80,
  name: 160,
  description: 4_000,
  ownerTeam: 160,
  ownerContact: 320,
  tags: 50,
  tag: 80,
  links: 25,
  linkLabel: 160,
  linkUrl: 2_048,
  hostname: 253,
  address: 2_048,
  addresses: 25,
  provider: 160,
  organization: 160,
  branch: 255,
  version: 255,
  revision: 255,
  environment: 80,
  location: 320,
  operatingSystem: 320,
  purpose: 1_000,
  dependencyKind: 80,
  relationships: 100,
  endpoint: 2_048,
  namespace: 255,
  runtimeName: 255,
  metadataEntries: 25,
  metadataArrayItems: 20,
  metadataString: 1_000,
  metadataBytes: 16_384,
  monitoringRetentionDays: 3_650,
  contextItemsPerCollection: 100,
  pageSize: 100,
});
