import { issuePeriodMetric, issueBreakdownMetric } from "./metrics/issues.js";
import { buildPendingTasksMetric } from "./metrics/tasks.js";
import { applicationHealthMetric } from "./health/queries.js";
import { getHomeConfiguration } from "./configuration/queries.js";
import { HOME_WIDGET_CATALOG } from "./widgets.js";
import { hasPermission } from "./support.js";
import { homeMonitoringApplications } from "./monitoringTopology.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

async function resolveWidgetMetric(database, actor, instance, now) {
  if (instance.widgetId === "issues-period")
    return issuePeriodMetric(database, actor, instance.config, now);
  if (instance.widgetId === "open-issues-by-application")
    return issueBreakdownMetric(database, actor, "applicationId");
  if (instance.widgetId === "open-issues-by-type")
    return issueBreakdownMetric(database, actor, "type");
  if (instance.widgetId === "pending-tasks")
    return buildPendingTasksMetric(database, actor);
  if (instance.widgetId === "application-health")
    return applicationHealthMetric(database, actor, instance.config);
  return { kind: "unknown" };
}

export async function getHomeDashboard(actor, { now = new Date() } = {}) {
  const database = await getMongoDatabase();
  const configuration = await getHomeConfiguration(actor);
  const catalog = HOME_WIDGET_CATALOG.filter(({ permission }) =>
    hasPermission(actor, permission),
  );
  const dataEntries = await Promise.all(
    configuration.widgets.map(async (instance) => [
      instance.id,
      await resolveWidgetMetric(database, actor, instance, now),
    ]),
  );
  const applications = await homeMonitoringApplications(database, actor);
  return {
    catalog,
    configuration,
    applications,
    data: Object.fromEntries(dataEntries),
    generatedAt: now,
  };
}
