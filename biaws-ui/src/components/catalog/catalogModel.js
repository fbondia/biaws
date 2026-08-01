export const CATALOG_ENTITY_LABELS = {
  application: "aplicação",
  integration: "integração",
  component: "componente",
  repository: "repositório",
  server: "servidor",
  deployment: "deployment",
  runtime: "runtime",
};

const DEFAULTS = {
  application: {
    key: "",
    name: "",
    description: "",
    ownerTeam: "",
    ownerContact: "",
    tagsText: "",
  },
  component: {
    key: "",
    name: "",
    description: "",
    type: "other",
    repositoryIds: [],
    dependencyIds: [],
    tagsText: "",
  },
  integration: {
    key: "",
    name: "",
    description: "",
    targetApplicationId: "",
  },
  repository: {
    key: "",
    name: "",
    description: "",
    provider: "other",
    organization: "",
    url: "",
    defaultBranch: "",
  },
  server: {
    key: "",
    name: "",
    description: "",
    hostname: "",
    addressesText: "",
    provider: "",
    location: "",
    operatingSystem: "",
    purpose: "",
    status: "active",
    tagsText: "",
  },
  deployment: {
    key: "",
    name: "",
    componentId: "",
    environment: "other",
    repositoryId: "",
    status: "planned",
    publications: [],
  },
  runtime: {
    key: "",
    name: "",
    kind: "other",
    serverId: "",
    endpoint: "",
    port: "",
    namespace: "",
    runtimeName: "",
    status: "unknown",
    metadataText: "{}",
    observations: [],
    procedureMarkdown: "",
  },
};

function lines(value) {
  return String(value || "")
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function catalogEntityDraft(kind, entity = {}) {
  const source = entity || {};
  const draft = { ...DEFAULTS[kind], ...source };
  if (kind === "application") {
    draft.ownerTeam = source.owner?.team || "";
    draft.ownerContact = source.owner?.contact || "";
    draft.tagsText = (source.tags || []).join(", ");
  }
  if (kind === "component") {
    draft.repositoryIds = (source.repositoryLinks || []).map(
      ({ repositoryId }) => repositoryId,
    );
    draft.dependencyIds = (source.dependencies || []).map(
      ({ componentId }) => componentId,
    );
    draft.tagsText = (source.tags || []).join(", ");
  }
  if (kind === "server") {
    draft.addressesText = (source.addresses || []).join("\n");
    draft.tagsText = (source.tags || []).join(", ");
  }
  if (kind === "deployment") {
    draft.repositoryId =
      source.repositoryId || source.source?.repositoryId || "";
    draft.publications = Array.isArray(source.publications)
      ? source.publications
      : source.version || source.source?.revision || source.deployedAt
        ? [
            {
              id: `legacy-${source.id || "publication"}`,
              version: source.version || "Versão não informada",
              revision: source.source?.revision || "",
              repositoryId: source.source?.repositoryId || "",
              publishedAt: source.deployedAt || source.updatedAt,
              description: "",
            },
          ]
        : [];
  }
  if (kind === "runtime") {
    draft.metadataText = JSON.stringify(source.metadata || {}, null, 2);
    draft.observations = Array.isArray(source.observations)
      ? source.observations
      : source.observedAt
        ? [
            {
              id: `legacy-${source.id || "observation"}`,
              healthStatus: source.status || "unknown",
              observedAt: source.observedAt,
              source: "",
              message: "",
              metadata: {},
            },
          ]
        : [];
    draft.port = source.port ?? "";
  }
  return draft;
}

function compact(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

const text = (value) => String(value || "").trim();

const PAYLOAD_BUILDERS = {
  application: (draft, common) => ({
    ...common,
    description: String(draft.description || "").trim(),
    owner: {
      team: String(draft.ownerTeam || "").trim(),
      contact: String(draft.ownerContact || "").trim(),
    },
    tags: lines(draft.tagsText),
  }),
  component: (draft, common) => ({
    ...common,
    description: text(draft.description),
    type: draft.type,
    repositoryLinks: (draft.repositoryIds || []).map((repositoryId) => ({
      repositoryId,
      role: "source",
    })),
    dependencies: (draft.dependencyIds || []).map((componentId) => ({
      componentId,
      kind: "runtime",
    })),
    tags: lines(draft.tagsText),
  }),
  integration: (draft, common, editing) => ({
    ...common,
    description: text(draft.description),
    targetApplicationId: editing ? undefined : draft.targetApplicationId,
  }),
  repository: (draft, common) => ({
    ...common,
    description: text(draft.description),
    provider: draft.provider,
    organization: text(draft.organization),
    url: text(draft.url),
    defaultBranch: text(draft.defaultBranch),
  }),
  server: (draft, common) => ({
    ...common,
    description: text(draft.description),
    hostname: text(draft.hostname),
    addresses: lines(draft.addressesText),
    provider: text(draft.provider),
    location: text(draft.location),
    operatingSystem: text(draft.operatingSystem),
    purpose: text(draft.purpose),
    status: draft.status,
    tags: lines(draft.tagsText),
  }),
  deployment: (draft, common, editing) => ({
    ...common,
    componentId: editing ? undefined : draft.componentId,
    environment: draft.environment,
    repositoryId: draft.repositoryId || null,
    publications: draft.publications,
    status: draft.status,
  }),
  runtime: (draft, common) => {
    let metadata;
    try {
      metadata = JSON.parse(draft.metadataText || "{}");
    } catch {
      throw new Error("Metadata deve ser um objeto JSON válido.");
    }
    if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
      throw new Error("Metadata deve ser um objeto JSON.");
    }
    return {
      ...common,
      kind: draft.kind,
      serverId: draft.serverId || null,
      endpoint: text(draft.endpoint),
      port: draft.port === "" ? null : Number(draft.port),
      namespace: text(draft.namespace),
      runtimeName: text(draft.runtimeName),
      status: draft.status,
      metadata,
      observations: draft.observations,
      procedureMarkdown: text(draft.procedureMarkdown),
    };
  },
};

export function catalogEntityPayload(kind, draft, editing = false) {
  const builder = PAYLOAD_BUILDERS[kind];
  if (!builder) throw new Error(`Tipo de catálogo desconhecido: ${kind}`);
  return compact(
    builder(
      draft,
      {
        key: text(draft.key),
        name: text(draft.name),
      },
      editing,
    ),
  );
}

export function runtimeMonitoringPath({
  application,
  component,
  deployment,
  runtime,
} = {}) {
  const identifiers = [
    application?.key,
    component?.key,
    deployment?.key,
    runtime?.key,
  ].map(text);
  return identifiers.every(Boolean) ? identifiers.join(".") : "";
}

export function monitoringSignalCurl({
  apiUrl,
  runtimeReference,
  workspaceId,
} = {}) {
  if (!apiUrl || !runtimeReference || !workspaceId) return "";
  return [
    `curl --request POST '${apiUrl}' \\`,
    `  --header 'Authorization: Bearer <api-key>' \\`,
    `  --header 'X-Biaws-Workspace-Id: ${workspaceId}' \\`,
    `  --header 'Content-Type: application/json' \\`,
    `  --data '{"signalId":"example:check:1","status":"healthy","source":"external-monitor"}'`,
  ].join("\n");
}
