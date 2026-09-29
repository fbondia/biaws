type HealthDate = Date | string | number | null | undefined;
export interface NamedItem {
  id: string;
  key?: string;
  name: string;
  componentId?: string;
  environment?: string;
}
export interface HealthRuntime extends NamedItem {
  applicationId: string;
  componentId?: string;
  deploymentId?: string;
  serverId?: string | null;
  status?: string;
  monitoringObservedAt?: HealthDate;
  monitoring?: {
    status?: string;
    observedAt?: HealthDate;
    receivedAt?: HealthDate;
    source?: string;
    message?: string;
  };
}
interface HealthPresentation {
  label: string;
  fields: Array<{
    key: string;
    label: string;
    format: string;
    visualization: string;
  }>;
  series: Array<Record<string, unknown>>;
}
export interface HealthSignal {
  id?: string;
  runtimeId: string;
  executionId?: string | null;
  trigger?: string;
  metadata?: Record<string, unknown>;
  metadataProfile?: Parameters<typeof monitoringMetadataPresentation>[0];
  templatePresentation?: HealthPresentation | null;
  metadataPresentation?: HealthPresentation | null;
}
export interface PendingExecution {
  runtimeId: string;
  [field: string]: unknown;
}
type HealthGroup<K extends string, C> = NamedItem & {
  counts: Record<string, number>;
  observedAt: HealthDate;
} & Record<K, C>;
type RuntimeItem = ReturnType<typeof runtimeHealthItem>;
type DeploymentGroup = HealthGroup<"runtimes", RuntimeItem[]>;
type ComponentGroup = HealthGroup<"deployments", Map<string, DeploymentGroup>>;
type ApplicationGroup = HealthGroup<"components", Map<string, ComponentGroup>>;
export interface HealthInput {
  applications?: NamedItem[];
  components?: NamedItem[];
  deployments?: NamedItem[];
  latestSignals?: HealthSignal[];
  pendingExecutions?: PendingExecution[];
  runtimes?: HealthRuntime[];
  servers?: NamedItem[];
}
import { monitoringMetadataPresentation } from "../../monitoring/metadataProfiles/model.js";

function incrementHealthCount(counts: Record<string, number>, status: string) {
  counts[status] = (counts[status] || 0) + 1;
}

function latestDate(current: HealthDate, candidate: HealthDate) {
  if (!candidate) return current || null;
  if (!current || new Date(candidate) > new Date(current)) return candidate;
  return current;
}

function namedTopologyItem(item: NamedItem | undefined, fallbackLabel: string) {
  return item || { id: "unknown", key: "unknown", name: fallbackLabel };
}

function getOrCreateHealthGroup<K extends string, C>(
  groups: Map<string, HealthGroup<K, C>>,
  item: NamedItem,
  childrenKey: K,
  children: C,
): HealthGroup<K, C> {
  let group = groups.get(item.id);
  if (!group) {
    group = {
      ...item,
      counts: {},
      observedAt: null,
      [childrenKey]: children,
    } as HealthGroup<K, C>;
    groups.set(item.id, group);
  }
  return group;
}

function recordHealthObservation(
  group: { counts: Record<string, number>; observedAt: HealthDate },
  status: string,
  observedAt: HealthDate,
) {
  incrementHealthCount(group.counts, status);
  group.observedAt = latestDate(group.observedAt, observedAt);
}

function runtimeHealthItem(
  runtime: HealthRuntime,
  status: string,
  observedAt: HealthDate,
  latestSignalsByRuntimeId: Map<string, HealthSignal>,
  pendingExecutionsByRuntimeId: Map<string, PendingExecution[]>,
  serversById: Map<string, NamedItem>,
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
          ...(latestSignal.metadataProfile ? { metadataProfile: latestSignal.metadataProfile } : {}),
          ...(metadataPresentation ? { metadataPresentation } : {}),
        }
      : null,
    pendingExecutions: pendingExecutionsByRuntimeId.get(runtime.id) || [],
    server: runtime.serverId ? serversById.get(runtime.serverId) || null : null,
  };
}

function compareNamedItems(left: NamedItem, right: NamedItem) {
  return left.name.localeCompare(right.name, "pt-BR");
}

function materializeDeploymentHealth(deployment: DeploymentGroup) {
  return {
    ...deployment,
    status: healthFromCounts(deployment.counts),
    runtimes: deployment.runtimes.toSorted(compareNamedItems),
  };
}

function materializeComponentHealth(component: ComponentGroup) {
  return {
    ...component,
    status: healthFromCounts(component.counts),
    deployments: [...component.deployments.values()].map(materializeDeploymentHealth).sort(compareNamedItems),
  };
}

function materializeApplicationHealth(application: ApplicationGroup) {
  return {
    ...application,
    status: healthFromCounts(application.counts),
    components: [...application.components.values()].map(materializeComponentHealth).sort(compareNamedItems),
  };
}

export function filterRuntimesByDeploymentEnvironment<R extends { deploymentId?: string }>(
  runtimes: R[] = [],
  deployments: { id: string; environment?: string }[] = [],
  environment = "",
) {
  if (!environment) return runtimes;
  const deploymentIds = new Set(
    deployments.filter((deployment) => deployment.environment === environment).map((deployment) => deployment.id),
  );
  return runtimes.filter((runtime) => deploymentIds.has(runtime.deploymentId || ""));
}

export function buildApplicationHealthItems({
  applications = [],
  components = [],
  deployments = [],
  latestSignals = [],
  pendingExecutions = [],
  runtimes = [],
  servers = [],
}: HealthInput = {}) {
  const applicationsById = new Map(applications.map((application) => [application.id, application]));
  const componentsById = new Map(components.map((component) => [component.id, component]));
  const deploymentsById = new Map(deployments.map((deployment) => [deployment.id, deployment]));
  const serversById = new Map(servers.map((server) => [server.id, server]));
  const latestSignalsByRuntimeId = new Map(latestSignals.map((signal) => [signal.runtimeId, signal]));
  const pendingExecutionsByRuntimeId = new Map<string, PendingExecution[]>();
  for (const execution of pendingExecutions) {
    const current = pendingExecutionsByRuntimeId.get(execution.runtimeId) || [];
    current.push(execution);
    pendingExecutionsByRuntimeId.set(execution.runtimeId, current);
  }
  const grouped = new Map<string, ApplicationGroup>();

  for (const runtime of runtimes) {
    const application = applicationsById.get(runtime.applicationId);
    if (!application) continue;
    const component = namedTopologyItem(componentsById.get(runtime.componentId || ""), "Componente não encontrado");
    const deployment = namedTopologyItem(deploymentsById.get(runtime.deploymentId || ""), "Deployment não encontrado");
    const status = runtime.monitoring?.status || runtime.status || "unknown";
    const observedAt = runtime.monitoring?.observedAt || runtime.monitoringObservedAt || null;
    const applicationGroup = getOrCreateHealthGroup(
      grouped,
      application,
      "components",
      new Map<string, ComponentGroup>(),
    );
    recordHealthObservation(applicationGroup, status, observedAt);

    const componentGroup = getOrCreateHealthGroup(
      applicationGroup.components,
      component,
      "deployments",
      new Map<string, DeploymentGroup>(),
    );
    recordHealthObservation(componentGroup, status, observedAt);

    const deploymentGroup = getOrCreateHealthGroup(
      componentGroup.deployments,
      deployment,
      "runtimes",
      [] as RuntimeItem[],
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

  return [...grouped.values()].map(materializeApplicationHealth).sort(compareNamedItems);
}

export function healthFromCounts(counts: Record<string, number>) {
  const priority = ["unavailable", "degraded", "stopped", "unknown", "healthy"];
  return priority.find((status) => Number(counts[status]) > 0) || "unknown";
}
