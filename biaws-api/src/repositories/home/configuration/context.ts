import type { Actor } from "../../../types/http.js";
import type { Db } from "mongodb";
import { homeError } from "../support.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";
import { actorCanAccessApplication } from "../../../auth/authorizationMiddleware.js";
import type { WidgetConfiguration } from "../widgets.js";
import type { normalizeHomeWidgets } from "../normalization.js";

type HomeWidgetInstance = ReturnType<typeof normalizeHomeWidgets>[number];

function configuredApplicationIds(widgets: HomeWidgetInstance[]) {
  return [
    ...new Set(
      widgets
        .map(({ config }) => config.applicationId)
        .filter(Boolean)
        .map(String),
    ),
  ];
}

function assertConfiguredApplicationAccess(widgets: HomeWidgetInstance[], actor: Partial<Actor>) {
  for (const instance of widgets) {
    const applicationId = instance.config.applicationId;
    if (applicationId && !actorCanAccessApplication(actor, "runtimes.read", applicationId)) {
      throw homeError(422, "INVALID_HOME_CONFIGURATION", "configured application is unavailable");
    }
  }
}

function configuredMonitoringTargets(config: WidgetConfiguration) {
  const { applicationId, componentId, deploymentId, runtimeId } = config;
  return [
    componentId
      ? {
          collection: COLLECTION_NAMES.APPLICATION_COMPONENTS,
          filter: { applicationId, id: componentId },
        }
      : null,
    deploymentId
      ? {
          collection: COLLECTION_NAMES.APPLICATION_DEPLOYMENTS,
          filter: { applicationId, componentId, id: deploymentId },
        }
      : null,
    runtimeId
      ? {
          collection: COLLECTION_NAMES.DEPLOYMENT_RUNTIMES,
          filter: {
            applicationId,
            componentId,
            deploymentId,
            id: runtimeId,
            monitoring: { $exists: true, $ne: null },
          },
        }
      : null,
  ].filter((target): target is NonNullable<typeof target> => target !== null);
}

async function assertMonitoringTargetAvailable(
  database: Db,
  target: ReturnType<typeof configuredMonitoringTargets>[number],
  workspaceId: string | null | undefined,
) {
  const available = await database.collection(target.collection).countDocuments({
    workspaceId,
    status: { $ne: "archived" },
    ...target.filter,
  });
  if (available !== 1) {
    throw homeError(422, "INVALID_HOME_CONFIGURATION", "configured monitoring target is unavailable");
  }
}

async function assertConfiguredMonitoringTargets(database: Db, widgets: HomeWidgetInstance[], actor: Partial<Actor>) {
  const healthWidgets = widgets.filter(({ widgetId }) => widgetId === "application-health");
  for (const instance of healthWidgets) {
    const targets = configuredMonitoringTargets(instance.config);
    for (const target of targets) {
      await assertMonitoringTargetAvailable(database, target, actor.workspaceId);
    }
  }
}

export async function validateConfiguredApplications(widgets: HomeWidgetInstance[], actor: Partial<Actor>) {
  assertConfiguredApplicationAccess(widgets, actor);
  const applicationIds = configuredApplicationIds(widgets);
  if (!applicationIds.length) return;
  const database = await getMongoDatabase();
  const applicationCount = await database.collection(COLLECTION_NAMES.APPLICATIONS).countDocuments({
    workspaceId: actor.workspaceId,
    id: { $in: applicationIds },
    status: { $ne: "archived" },
  });
  if (applicationCount !== applicationIds.length) {
    throw homeError(422, "INVALID_HOME_CONFIGURATION", "configured application is unavailable");
  }
  await assertConfiguredMonitoringTargets(database, widgets, actor);
}
