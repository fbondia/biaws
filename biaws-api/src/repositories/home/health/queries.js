import { applicationScope } from "../filters.js";
import {
  filterRuntimesByDeploymentEnvironment,
  buildApplicationHealthItems,
} from "./model.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";

async function latestRuntimeMonitoringSignals(
  database,
  workspaceId,
  runtimeIds,
) {
  if (!runtimeIds.length) return [];
  return database
    .collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS)
    .aggregate([
      {
        $match: {
          workspaceId,
          runtimeId: { $in: runtimeIds },
          $or: [
            { origin: "passive" },
            { origin: "active" },
            { origin: "external" },
            { origin: { $exists: false } },
          ],
        },
      },
      { $sort: { observedAt: -1, receivedAt: -1, id: -1 } },
      { $group: { _id: "$runtimeId", signal: { $first: "$$ROOT" } } },
      {
        $project: {
          _id: 0,
          id: "$signal.id",
          runtimeId: "$signal.runtimeId",
          executionId: "$signal.executionId",
          trigger: "$signal.trigger",
          metadata: "$signal.metadata",
          metadataProfile: "$signal.metadataProfile",
          metadataPresentation: "$signal.metadataPresentation",
          templatePresentation: "$signal.templateSnapshot.presentation",
        },
      },
    ])
    .toArray();
}

async function pendingRuntimeManualExecutions(
  database,
  workspaceId,
  runtimeIds,
) {
  if (!runtimeIds.length) return [];
  const monitors = await database
    .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
    .find({
      workspaceId,
      runtimeId: { $in: runtimeIds },
      archivedAt: { $exists: false },
      $or: [
        { "manualRunRequest.id": { $exists: true } },
        {
          "lease.trigger": "manual",
          "lease.completedAt": { $exists: false },
        },
      ],
    })
    .project({ _id: 0, runtimeId: 1, manualRunRequest: 1, lease: 1 })
    .toArray();
  return monitors.map((monitor) =>
    monitor.manualRunRequest
      ? {
          id: monitor.manualRunRequest.id,
          runtimeId: monitor.runtimeId,
          status: "queued",
        }
      : {
          id: monitor.lease.executionId,
          runtimeId: monitor.runtimeId,
          status: "running",
        },
  );
}

function applicationHealthApplicationFilter(actor, config) {
  const applicationIds = applicationScope(actor, "runtimes.read");
  const configuredId = String(config.applicationId || "");
  const filter = {
    workspaceId: actor.workspaceId,
    status: { $ne: "archived" },
  };
  if (configuredId) {
    const available =
      applicationIds === null || applicationIds.includes(configuredId);
    filter.id = available ? configuredId : { $in: [] };
  } else if (applicationIds) {
    filter.id = { $in: applicationIds };
  }
  return { configuredId, filter };
}

async function configuredApplicationHealthRuntimeIds(
  database,
  workspaceId,
  applicationIds,
  includeConfigured,
) {
  if (!includeConfigured) return [];
  return database
    .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
    .distinct("runtimeId", {
      workspaceId,
      applicationId: { $in: applicationIds },
      archivedAt: { $exists: false },
    });
}

function applicationHealthRuntimeFilter(
  actor,
  config,
  applicationIds,
  configuredRuntimeIds,
) {
  const monitoringFilter = config.includeConfigured
    ? {
        $or: [
          { monitoring: { $exists: true, $ne: null } },
          { id: { $in: configuredRuntimeIds } },
        ],
      }
    : { monitoring: { $exists: true, $ne: null } };
  return {
    workspaceId: actor.workspaceId,
    applicationId: { $in: applicationIds },
    ...(config.componentId ? { componentId: config.componentId } : {}),
    ...(config.deploymentId ? { deploymentId: config.deploymentId } : {}),
    ...(config.runtimeId ? { id: config.runtimeId } : {}),
    status: { $ne: "archived" },
    ...monitoringFilter,
  };
}

async function applicationHealthRuntimes(
  database,
  actor,
  config,
  applicationIds,
  configuredRuntimeIds,
) {
  if (!applicationIds.length) return [];
  return database
    .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
    .find(
      applicationHealthRuntimeFilter(
        actor,
        config,
        applicationIds,
        configuredRuntimeIds,
      ),
    )
    .project({
      _id: 0,
      id: 1,
      key: 1,
      name: 1,
      applicationId: 1,
      componentId: 1,
      deploymentId: 1,
      serverId: 1,
      status: 1,
      monitoring: 1,
      monitoringObservedAt: 1,
    })
    .toArray();
}

function applicationHealthReferenceIds(runtimes) {
  return {
    componentIds: [...new Set(runtimes.map(({ componentId }) => componentId))],
    deploymentIds: [
      ...new Set(runtimes.map(({ deploymentId }) => deploymentId)),
    ],
    serverIds: [
      ...new Set(runtimes.map(({ serverId }) => serverId).filter(Boolean)),
    ],
  };
}

async function applicationHealthTopology(
  database,
  workspaceId,
  applicationIds,
  runtimes,
) {
  const { componentIds, deploymentIds, serverIds } =
    applicationHealthReferenceIds(runtimes);
  const [components, deployments, servers] = await Promise.all([
    componentIds.length
      ? database
          .collection(COLLECTION_NAMES.APPLICATION_COMPONENTS)
          .find({
            workspaceId,
            applicationId: { $in: applicationIds },
            id: { $in: componentIds },
          })
          .project({ _id: 0, id: 1, key: 1, name: 1 })
          .toArray()
      : [],
    deploymentIds.length
      ? database
          .collection(COLLECTION_NAMES.APPLICATION_DEPLOYMENTS)
          .find({
            workspaceId,
            applicationId: { $in: applicationIds },
            id: { $in: deploymentIds },
          })
          .project({
            _id: 0,
            id: 1,
            key: 1,
            name: 1,
            componentId: 1,
            environment: 1,
          })
          .toArray()
      : [],
    serverIds.length
      ? database
          .collection(COLLECTION_NAMES.SERVERS)
          .find({ workspaceId, id: { $in: serverIds } })
          .project({ _id: 0, id: 1, key: 1, name: 1 })
          .toArray()
      : [],
  ]);
  return { components, deployments, servers };
}

function materializeApplicationHealthRuntime(runtime, includeConfigured) {
  return includeConfigured && !runtime.monitoring
    ? { ...runtime, status: "unknown" }
    : runtime;
}

export async function applicationHealthMetric(database, actor, config) {
  const { configuredId, filter: applicationFilter } =
    applicationHealthApplicationFilter(actor, config);
  const applications = await database
    .collection(COLLECTION_NAMES.APPLICATIONS)
    .find(applicationFilter)
    .project({ _id: 0, id: 1, name: 1 })
    .sort({ name: 1 })
    .toArray();
  const ids = applications.map(({ id }) => id);
  const configuredRuntimeIds = await configuredApplicationHealthRuntimeIds(
    database,
    actor.workspaceId,
    ids,
    config.includeConfigured,
  );
  const runtimes = await applicationHealthRuntimes(
    database,
    actor,
    config,
    ids,
    configuredRuntimeIds,
  );
  const { components, deployments, servers } = await applicationHealthTopology(
    database,
    actor.workspaceId,
    ids,
    runtimes,
  );
  const filteredRuntimes = filterRuntimesByDeploymentEnvironment(
    runtimes,
    deployments,
    config.environment,
  );
  const runtimeIds = filteredRuntimes.map(({ id }) => id);
  const [latestSignals, pendingExecutions] = await Promise.all([
    latestRuntimeMonitoringSignals(database, actor.workspaceId, runtimeIds),
    pendingRuntimeManualExecutions(database, actor.workspaceId, runtimeIds),
  ]);
  const items = buildApplicationHealthItems({
    applications,
    components,
    deployments,
    latestSignals,
    pendingExecutions,
    runtimes: filteredRuntimes.map((runtime) =>
      materializeApplicationHealthRuntime(runtime, config.includeConfigured),
    ),
    servers,
  });
  return {
    kind: "health",
    items,
    applicationId: configuredId || null,
    environment: config.environment || null,
  };
}

export async function getApplicationHealthMetric(actor, config = {}) {
  const database = await getMongoDatabase();
  return applicationHealthMetric(database, actor, config);
}
