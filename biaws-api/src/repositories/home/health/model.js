import { monitoringMetadataPresentation } from "../../monitoring/metadataProfiles/model.js";

function incrementHealthCount(counts, status) {
  counts[status] = (counts[status] || 0) + 1;
}

function latestDate(current, candidate) {
  if (!candidate) return current || null;
  if (!current || new Date(candidate) > new Date(current)) return candidate;
  return current;
}

function namedTopologyItem(item, fallbackLabel) {
  return item || { id: "unknown", key: "unknown", name: fallbackLabel };
}

function getOrCreateHealthGroup(groups, item, childrenKey, children) {
  let group = groups.get(item.id);
  if (!group) {
    group = {
      ...item,
      counts: {},
      observedAt: null,
      [childrenKey]: children,
    };
    groups.set(item.id, group);
  }
  return group;
}

function recordHealthObservation(group, status, observedAt) {
  incrementHealthCount(group.counts, status);
  group.observedAt = latestDate(group.observedAt, observedAt);
}

function runtimeHealthItem(
  runtime,
  status,
  observedAt,
  latestSignalsByRuntimeId,
  pendingExecutionsByRuntimeId,
  serversById,
) {
  const latestSignal = latestSignalsByRuntimeId.get(runtime.id) || null;
  const metadataPresentation =
    latestSignal?.templatePresentation ||
    latestSignal?.metadataPresentation ||
    monitoringMetadataPresentation(latestSignal?.metadataProfile);
  return {
    id: runtime.id,
    key: runtime.key,
    name: runtime.name,
    status,
    observedAt,
    receivedAt: runtime.monitoring?.receivedAt || null,
    source: runtime.monitoring?.source || "",
    message: runtime.monitoring?.message || "",
    latestSignal: latestSignal
      ? {
          id: latestSignal.id,
          executionId: latestSignal.executionId,
          trigger: latestSignal.trigger,
          metadata: latestSignal.metadata || {},
          ...(latestSignal.metadataProfile
            ? { metadataProfile: latestSignal.metadataProfile }
            : {}),
          ...(metadataPresentation ? { metadataPresentation } : {}),
        }
      : null,
    pendingExecutions: pendingExecutionsByRuntimeId.get(runtime.id) || [],
    server: runtime.serverId ? serversById.get(runtime.serverId) || null : null,
  };
}

function compareNamedItems(left, right) {
  return left.name.localeCompare(right.name, "pt-BR");
}

function materializeDeploymentHealth(deployment) {
  return {
    ...deployment,
    status: healthFromCounts(deployment.counts),
    runtimes: deployment.runtimes.sort(compareNamedItems),
  };
}

function materializeComponentHealth(component) {
  return {
    ...component,
    status: healthFromCounts(component.counts),
    deployments: [...component.deployments.values()]
      .map(materializeDeploymentHealth)
      .sort(compareNamedItems),
  };
}

function materializeApplicationHealth(application) {
  return {
    ...application,
    status: healthFromCounts(application.counts),
    components: [...application.components.values()]
      .map(materializeComponentHealth)
      .sort(compareNamedItems),
  };
}

export function filterRuntimesByDeploymentEnvironment(
  runtimes = [],
  deployments = [],
  environment = "",
) {
  if (!environment) return runtimes;
  const deploymentIds = new Set(
    deployments
      .filter((deployment) => deployment.environment === environment)
      .map((deployment) => deployment.id),
  );
  return runtimes.filter((runtime) => deploymentIds.has(runtime.deploymentId));
}

export function buildApplicationHealthItems({
  applications = [],
  components = [],
  deployments = [],
  latestSignals = [],
  pendingExecutions = [],
  runtimes = [],
  servers = [],
} = {}) {
  const applicationsById = new Map(
    applications.map((application) => [application.id, application]),
  );
  const componentsById = new Map(
    components.map((component) => [component.id, component]),
  );
  const deploymentsById = new Map(
    deployments.map((deployment) => [deployment.id, deployment]),
  );
  const serversById = new Map(servers.map((server) => [server.id, server]));
  const latestSignalsByRuntimeId = new Map(
    latestSignals.map((signal) => [signal.runtimeId, signal]),
  );
  const pendingExecutionsByRuntimeId = new Map();
  for (const execution of pendingExecutions) {
    const current = pendingExecutionsByRuntimeId.get(execution.runtimeId) || [];
    current.push(execution);
    pendingExecutionsByRuntimeId.set(execution.runtimeId, current);
  }
  const grouped = new Map();

  for (const runtime of runtimes) {
    const application = applicationsById.get(runtime.applicationId);
    if (!application) continue;
    const component = namedTopologyItem(
      componentsById.get(runtime.componentId),
      "Componente não encontrado",
    );
    const deployment = namedTopologyItem(
      deploymentsById.get(runtime.deploymentId),
      "Deployment não encontrado",
    );
    const status = runtime.monitoring?.status || runtime.status || "unknown";
    const observedAt =
      runtime.monitoring?.observedAt || runtime.monitoringObservedAt || null;
    const applicationGroup = getOrCreateHealthGroup(
      grouped,
      application,
      "components",
      new Map(),
    );
    recordHealthObservation(applicationGroup, status, observedAt);

    const componentGroup = getOrCreateHealthGroup(
      applicationGroup.components,
      component,
      "deployments",
      new Map(),
    );
    recordHealthObservation(componentGroup, status, observedAt);

    const deploymentGroup = getOrCreateHealthGroup(
      componentGroup.deployments,
      deployment,
      "runtimes",
      [],
    );
    recordHealthObservation(deploymentGroup, status, observedAt);
    deploymentGroup.runtimes.push(
      runtimeHealthItem(
        runtime,
        status,
        observedAt,
        latestSignalsByRuntimeId,
        pendingExecutionsByRuntimeId,
        serversById,
      ),
    );
  }

  return [...grouped.values()]
    .map(materializeApplicationHealth)
    .sort(compareNamedItems);
}

export function healthFromCounts(counts) {
  const priority = ["unavailable", "degraded", "stopped", "unknown", "healthy"];
  return priority.find((status) => Number(counts[status]) > 0) || "unknown";
}
