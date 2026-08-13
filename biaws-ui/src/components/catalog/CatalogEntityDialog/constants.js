export const COMPONENT_TYPES = [
  "api",
  "ui",
  "worker",
  "service",
  "library",
  "integration",
  "other",
];

export const REPOSITORY_PROVIDERS = [
  "github",
  "gitlab",
  "bitbucket",
  "azure-devops",
  "local",
  "other",
];

export const ENVIRONMENTS = [
  "development",
  "test",
  "staging",
  "production",
  "other",
];

export const DEPLOYMENT_STATUSES = [
  "planned",
  "deploying",
  "active",
  "inactive",
  "failed",
];

export const PUBLICATION_STATUSES = [
  { value: "planned", label: "Planejada" },
  { value: "canceled", label: "Cancelada" },
  { value: "deployed", label: "Implantada" },
];

export const RUNTIME_KINDS = [
  "process",
  "container",
  "kubernetes",
  "serverless",
  "managed",
  "external",
  "other",
];

export const RUNTIME_STATUSES = [
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
  "stopped",
];

export const SERVER_STATUSES = ["active", "maintenance", "retired"];

export const DOCUMENT_PURPOSES = [
  ["operation", "Operação"],
  ["deployment", "Deployment"],
  ["rollback", "Rollback"],
  ["troubleshooting", "Troubleshooting"],
  ["monitoring", "Monitoramento"],
  ["reference", "Referência"],
];

export const EMPTY_PUBLICATION_DRAFT = {
  version: "",
  revision: "",
  status: "planned",
  publishedAt: "",
  description: "",
};

export const EMPTY_OBSERVATION_DRAFT = {
  healthStatus: "unknown",
  observedAt: "",
  source: "",
  message: "",
};

export const EMPTY_ACTIVE_MONITOR_DRAFT = {
  id: "",
  name: "",
  description: "",
  provider: "rest",
  enabled: true,
  intervalSeconds: 60,
  timeoutSeconds: 10,
  restMethod: "GET",
  restUrl: "",
  restHeadersText: "{}",
  restHeaderRefsText: "[]",
  restBody: "",
  restExpectedStatusesText: "200",
  restFollowRedirects: false,
  shellScriptId: "",
  shellArgumentsText: "",
  shellEnvironmentText: "{}",
  templateId: "",
  templateVersion: "",
};
