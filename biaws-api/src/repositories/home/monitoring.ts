import type { Db } from "mongodb";
import type { Actor } from "../../types/http.js";
import { applicationHealthMetric } from "./health/queries.js";
import { getHomeConfiguration } from "./configuration/queries.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import type { normalizeHomeWidgets } from "./normalization.js";

async function monitoringWidgetData(
  database: Db,
  actor: Partial<Actor>,
  widgets: ReturnType<typeof normalizeHomeWidgets>,
) {
  const entries = await Promise.all(
    widgets
      .filter(({ widgetId }) => widgetId === "application-health")
      .map(async (instance) => [
        instance.id,
        await applicationHealthMetric(database, actor, instance.config),
      ]),
  );
  return Object.fromEntries(entries);
}

export async function getHomeMonitoringData(
  actor: Actor,
  { now = new Date() } = {},
) {
  const database = await getMongoDatabase();
  const configuration = await getHomeConfiguration(actor);
  return {
    data: await monitoringWidgetData(database, actor, configuration.widgets),
    generatedAt: now,
  };
}
