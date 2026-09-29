import { applicationHealthMetric } from "./health/queries.js";
import { getHomeConfiguration } from "./configuration/queries.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

async function monitoringWidgetData(database, actor, widgets) {
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

export async function getHomeMonitoringData(actor, { now = new Date() } = {}) {
  const database = await getMongoDatabase();
  const configuration = await getHomeConfiguration(actor);
  return {
    data: await monitoringWidgetData(database, actor, configuration.widgets),
    generatedAt: now,
  };
}
