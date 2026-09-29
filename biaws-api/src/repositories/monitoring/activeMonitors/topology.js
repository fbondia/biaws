import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";
import { activeMonitorCollection } from "./storage.js";

export async function getMonitoredRuntimeTopology(authorizationScope = {}) {
  const workspaceId = String(authorizationScope.workspaceId || "");
  if (!workspaceId) {
    return {
      applicationIds: [],
      componentIds: [],
      deploymentIds: [],
      runtimeIds: [],
    };
  }
  const applicationIds = authorizationScope.workspace
    ? []
    : (authorizationScope.applicationIds || []).map(String);
  const collection = await activeMonitorCollection();
  const monitoredRuntimeIds = await collection.distinct("runtimeId", {
    workspaceId,
    archivedAt: { $exists: false },
    ...(authorizationScope.workspace
      ? {}
      : { applicationId: { $in: applicationIds } }),
  });
  if (!monitoredRuntimeIds.length) {
    return {
      applicationIds: [],
      componentIds: [],
      deploymentIds: [],
      runtimeIds: [],
    };
  }
  const database = await getMongoDatabase();
  const runtimes = await database
    .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
    .find(
      {
        workspaceId,
        id: { $in: monitoredRuntimeIds },
        status: { $ne: "archived" },
        ...(authorizationScope.workspace
          ? {}
          : { applicationId: { $in: applicationIds } }),
      },
      {
        projection: {
          _id: 0,
          id: 1,
          applicationId: 1,
          componentId: 1,
          deploymentId: 1,
        },
      },
    )
    .toArray();
  const unique = (field) =>
    [
      ...new Set(runtimes.map((runtime) => runtime[field]).filter(Boolean)),
    ].sort((left, right) => left.localeCompare(right));
  return {
    applicationIds: unique("applicationId"),
    componentIds: unique("componentId"),
    deploymentIds: unique("deploymentId"),
    runtimeIds: unique("id"),
  };
}

export async function listMonitoredRuntimeTargets(authorizationScope = {}) {
  const topology = await getMonitoredRuntimeTopology(authorizationScope);
  if (!topology.runtimeIds.length) return [];

  const workspaceId = String(authorizationScope.workspaceId || "");
  const database = await getMongoDatabase();
  const [runtimes, applications, components, deployments, monitorCounts] =
    await Promise.all([
      database
        .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
        .find({
          workspaceId,
          id: { $in: topology.runtimeIds },
          status: { $ne: "archived" },
        })
        .project({
          _id: 0,
          id: 1,
          key: 1,
          name: 1,
          applicationId: 1,
          componentId: 1,
          deploymentId: 1,
        })
        .toArray(),
      database
        .collection(COLLECTION_NAMES.APPLICATIONS)
        .find({ workspaceId, id: { $in: topology.applicationIds } })
        .project({ _id: 0, id: 1, key: 1, name: 1, collectionId: 1 })
        .toArray(),
      database
        .collection(COLLECTION_NAMES.APPLICATION_COMPONENTS)
        .find({ workspaceId, id: { $in: topology.componentIds } })
        .project({ _id: 0, id: 1, key: 1, name: 1 })
        .toArray(),
      database
        .collection(COLLECTION_NAMES.APPLICATION_DEPLOYMENTS)
        .find({ workspaceId, id: { $in: topology.deploymentIds } })
        .project({
          _id: 0,
          id: 1,
          key: 1,
          name: 1,
          environment: 1,
        })
        .toArray(),
      (await activeMonitorCollection())
        .aggregate([
          {
            $match: {
              workspaceId,
              runtimeId: { $in: topology.runtimeIds },
              archivedAt: { $exists: false },
            },
          },
          {
            $group: {
              _id: "$runtimeId",
              monitorCount: { $sum: 1 },
              enabledMonitorCount: {
                $sum: { $cond: ["$enabled", 1, 0] },
              },
              monitorNames: { $push: "$name" },
            },
          },
        ])
        .toArray(),
    ]);

  const byId = (items) => new Map(items.map((item) => [item.id, item]));
  const applicationsById = byId(applications);
  const componentsById = byId(components);
  const deploymentsById = byId(deployments);
  const countsByRuntimeId = new Map(
    monitorCounts.map((item) => [item._id, item]),
  );
  return runtimes
    .map((runtime) => {
      const application = applicationsById.get(runtime.applicationId);
      const component = componentsById.get(runtime.componentId);
      const deployment = deploymentsById.get(runtime.deploymentId);
      const counts = countsByRuntimeId.get(runtime.id) || {};
      return {
        ...runtime,
        application: application || null,
        component: component || null,
        deployment: deployment || null,
        monitorCount: counts.monitorCount || 0,
        enabledMonitorCount: counts.enabledMonitorCount || 0,
        monitorNames: (counts.monitorNames || []).sort((left, right) =>
          left.localeCompare(right, "pt-BR"),
        ),
      };
    })
    .sort((left, right) =>
      [
        left.application?.name,
        left.component?.name,
        left.deployment?.name,
        left.name,
      ]
        .join("\u0000")
        .localeCompare(
          [
            right.application?.name,
            right.component?.name,
            right.deployment?.name,
            right.name,
          ].join("\u0000"),
          "pt-BR",
        ),
    );
}
