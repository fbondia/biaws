import { randomUUID } from "node:crypto";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { actorCanAccessApplication } from "../auth/authorizationMiddleware.js";

const MAX_WIDGETS = 30;
const WIDGET_SIZES = new Set(["small", "medium", "large"]);
const COMPLETED_TASK_STATUSES = [
  "Concluído",
  "Concluido",
  "Completed",
  "Done",
  "closed",
];

export const HOME_WIDGET_CATALOG = Object.freeze([
  {
    id: "issues-period",
    category: "Chamados",
    label: "Chamados no período",
    description: "Quantidade de chamados recebidos na semana ou no mês atual.",
    permission: "issues.read",
    defaultSize: "small",
    configuration: {
      fields: [
        {
          key: "period",
          label: "Período",
          type: "select",
          required: true,
          options: [
            { value: "week", label: "Semana atual" },
            { value: "month", label: "Mês atual" },
          ],
        },
      ],
    },
  },
  {
    id: "open-issues-by-application",
    category: "Chamados",
    label: "Chamados abertos por aplicação",
    description: "Distribuição dos chamados em aberto pelos sistemas.",
    permission: "issues.read",
    defaultSize: "medium",
    configuration: { fields: [] },
  },
  {
    id: "open-issues-by-type",
    category: "Chamados",
    label: "Chamados abertos por tipo",
    description: "Distribuição dos chamados em aberto por tipo.",
    permission: "issues.read",
    defaultSize: "medium",
    configuration: { fields: [] },
  },
  {
    id: "pending-tasks",
    category: "Melhorias",
    label: "Tarefas pendentes",
    description: "Tarefas ainda não concluídas nas melhorias acessíveis.",
    permission: "demands.read",
    defaultSize: "medium",
    configuration: { fields: [] },
  },
  {
    id: "application-health",
    category: "Monitoramento",
    label: "Saúde das aplicações",
    description: "Aplicações monitoradas em estado OK e NOK.",
    permission: "runtimes.read",
    defaultSize: "medium",
    configuration: {
      fields: [
        {
          key: "applicationId",
          label: "Aplicação",
          type: "application",
          required: false,
          emptyLabel: "Todas as aplicações",
        },
      ],
    },
  },
]);

const widgetById = new Map(
  HOME_WIDGET_CATALOG.map((widget) => [widget.id, widget]),
);
let collectionPromise;

function homeError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function hasPermission(actor, permission) {
  return actor?.permissions?.includes(permission) === true;
}

function defaultConfiguration(widgetId) {
  if (widgetId === "issues-period") return { period: "week" };
  return {};
}

function normalizeConfiguration(widget, value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "widget config must be an object",
    );
  }
  const allowed = new Set(
    (widget.configuration?.fields || []).map(({ key }) => key),
  );
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      `unknown ${widget.id} configuration fields: ${unknown.join(", ")}`,
    );
  }
  if (widget.id === "issues-period") {
    const period = String(value.period || "week");
    if (!["week", "month"].includes(period)) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        "period must be week or month",
      );
    }
    return { period };
  }
  if (widget.id === "application-health") {
    return { applicationId: String(value.applicationId || "").trim() };
  }
  return {};
}

export function normalizeHomeWidgets(value, actor = {}) {
  if (!Array.isArray(value) || value.length > MAX_WIDGETS) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      `widgets must be an array with at most ${MAX_WIDGETS} items`,
    );
  }
  const ids = new Set();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        `widgets[${index}] must be an object`,
      );
    }
    const widget = widgetById.get(String(item.widgetId || ""));
    if (!widget || !hasPermission(actor, widget.permission)) {
      throw homeError(
        422,
        "INVALID_HOME_WIDGET",
        `widget is unavailable: ${item.widgetId || "unknown"}`,
      );
    }
    const id = String(item.id || randomUUID()).trim();
    if (!id || id.length > 128 || ids.has(id)) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        `widgets[${index}].id must be unique`,
      );
    }
    ids.add(id);
    const size = String(item.size || widget.defaultSize);
    if (!WIDGET_SIZES.has(size)) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        `widgets[${index}].size is invalid`,
      );
    }
    return {
      id,
      widgetId: widget.id,
      size,
      config: normalizeConfiguration(
        widget,
        item.config ?? defaultConfiguration(widget.id),
      ),
    };
  });
}

export function defaultHomeWidgets(actor = {}) {
  const defaults = [
    ["issues-period", { period: "week" }, "small"],
    ["issues-period", { period: "month" }, "small"],
    ["open-issues-by-application", {}, "medium"],
    ["open-issues-by-type", {}, "medium"],
    ["pending-tasks", {}, "medium"],
    ["application-health", { applicationId: "" }, "medium"],
  ];
  return defaults
    .filter(([widgetId]) =>
      hasPermission(actor, widgetById.get(widgetId).permission),
    )
    .map(([widgetId, config, size], index) => ({
      id: `default-${widgetId}-${index + 1}`,
      widgetId,
      size,
      config,
    }));
}

async function homeCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const database = await getMongoDatabase();
      const collection = database.collection(
        COLLECTION_NAMES.HOME_CONFIGURATIONS,
      );
      await Promise.all([
        collection.createIndex(
          { workspaceId: 1, userId: 1 },
          { unique: true, name: "workspace_user_home_unique" },
        ),
        collection.createIndex({ workspaceId: 1, updatedAt: -1 }),
      ]);
      return collection;
    })().catch((error) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

export async function getHomeConfiguration(actor) {
  const collection = await homeCollection();
  const document = await collection.findOne({
    workspaceId: actor.workspaceId,
    userId: actor.userId,
  });
  const source = document?.widgets || defaultHomeWidgets(actor);
  const available = source.filter((item) => {
    const widget = widgetById.get(item.widgetId);
    return widget && hasPermission(actor, widget.permission);
  });
  return {
    widgets: normalizeHomeWidgets(available, actor),
    customized: Boolean(document),
    updatedAt: document?.updatedAt || null,
  };
}

export async function saveHomeConfiguration(payload = {}, actor) {
  const unknown = Object.keys(payload || {}).filter((key) => key !== "widgets");
  if (unknown.length) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      `unknown home fields: ${unknown.join(", ")}`,
    );
  }
  const widgets = normalizeHomeWidgets(payload.widgets, actor);
  const configuredApplicationIds = [
    ...new Set(
      widgets
        .map(({ config }) => config.applicationId)
        .filter(Boolean)
        .map(String),
    ),
  ];
  for (const instance of widgets) {
    const applicationId = instance.config.applicationId;
    if (
      applicationId &&
      !actorCanAccessApplication(actor, "runtimes.read", applicationId)
    ) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        "configured application is unavailable",
      );
    }
  }
  if (configuredApplicationIds.length) {
    const database = await getMongoDatabase();
    const applicationCount = await database
      .collection(COLLECTION_NAMES.APPLICATIONS)
      .countDocuments({
        workspaceId: actor.workspaceId,
        id: { $in: configuredApplicationIds },
        status: { $ne: "archived" },
      });
    if (applicationCount !== configuredApplicationIds.length) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        "configured application is unavailable",
      );
    }
  }
  const collection = await homeCollection();
  const now = new Date();
  await collection.updateOne(
    { workspaceId: actor.workspaceId, userId: actor.userId },
    {
      $set: { widgets, updatedAt: now, updatedBy: actor.userId },
      $setOnInsert: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return { widgets, customized: true, updatedAt: now };
}

function applicationScope(actor, permission) {
  const scope = actor.permissionScopes?.[permission];
  return scope?.workspace ? null : (scope?.applicationIds || []).map(String);
}

function scopedFilter(actor, permission) {
  const filter = { workspaceId: actor.workspaceId };
  const applicationIds = applicationScope(actor, permission);
  if (applicationIds) filter.applicationId = { $in: applicationIds };
  return filter;
}

function utcPeriodStart(period, now = new Date()) {
  if (period === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  return start;
}

function healthFromCounts(counts) {
  const priority = ["unavailable", "degraded", "stopped", "unknown", "healthy"];
  return priority.find((status) => Number(counts[status]) > 0) || "unknown";
}

async function issuePeriodMetric(database, actor, config, now) {
  const period = config.period || "week";
  const count = await database
    .collection(COLLECTION_NAMES.ISSUES)
    .countDocuments({
      ...scopedFilter(actor, "issues.read"),
      "dates.receivedEmailAt": { $gte: utcPeriodStart(period, now), $lte: now },
    });
  return {
    kind: "stat",
    value: count,
    period,
    from: utcPeriodStart(period, now),
    to: now,
  };
}

async function issueBreakdownMetric(database, actor, field) {
  const rows = await database
    .collection(COLLECTION_NAMES.ISSUES)
    .aggregate([
      {
        $match: {
          ...scopedFilter(actor, "issues.read"),
          status: { $ne: "closed" },
        },
      },
      { $group: { _id: `$${field}`, value: { $sum: 1 } } },
      { $sort: { value: -1, _id: 1 } },
      { $limit: 12 },
    ])
    .toArray();
  if (field === "applicationId") {
    const ids = rows.map(({ _id }) => _id).filter(Boolean);
    const applications = await database
      .collection(COLLECTION_NAMES.APPLICATIONS)
      .find({ workspaceId: actor.workspaceId, id: { $in: ids } })
      .project({ _id: 0, id: 1, name: 1 })
      .toArray();
    const names = new Map(applications.map(({ id, name }) => [id, name]));
    return {
      kind: "breakdown",
      items: rows.map((row) => ({
        key: row._id || "unknown",
        label: names.get(row._id) || "Sem aplicação",
        value: row.value,
      })),
    };
  }
  return {
    kind: "breakdown",
    items: rows.map((row) => ({
      key: row._id || "unknown",
      label: row._id || "Não informado",
      value: row.value,
    })),
  };
}

async function pendingTasksMetric(database, actor) {
  const requests = await database
    .collection(COLLECTION_NAMES.REQUESTS)
    .find(scopedFilter(actor, "demands.read"))
    .project({ _id: 1, title: 1 })
    .toArray();
  const requestIds = requests.map(({ _id }) => _id);
  if (!requestIds.length) return { kind: "tasks", value: 0, items: [] };
  const filter = {
    requestId: { $in: requestIds },
    status: { $nin: COMPLETED_TASK_STATUSES },
  };
  const [value, tasks] = await Promise.all([
    database.collection(COLLECTION_NAMES.REQUEST_TASKS).countDocuments(filter),
    database
      .collection(COLLECTION_NAMES.REQUEST_TASKS)
      .find(filter)
      .sort({ endDate: 1, createdAt: -1 })
      .limit(6)
      .toArray(),
  ]);
  const requestNames = new Map(
    requests.map(({ _id, title }) => [_id.toString(), title]),
  );
  return {
    kind: "tasks",
    value,
    items: tasks.map((task) => ({
      id: task._id.toString(),
      title: task.title,
      status: task.status,
      endDate: task.endDate || "",
      requestTitle: requestNames.get(task.requestId?.toString()) || "Melhoria",
    })),
  };
}

async function applicationHealthMetric(database, actor, config) {
  const applicationIds = applicationScope(actor, "runtimes.read");
  const configuredId = String(config.applicationId || "");
  const configuredAvailable =
    !configuredId ||
    applicationIds === null ||
    applicationIds.includes(configuredId);
  const applicationFilter = {
    workspaceId: actor.workspaceId,
    status: { $ne: "archived" },
    ...(configuredId
      ? { id: configuredAvailable ? configuredId : { $in: [] } }
      : applicationIds
        ? { id: { $in: applicationIds } }
        : {}),
  };
  const applications = await database
    .collection(COLLECTION_NAMES.APPLICATIONS)
    .find(applicationFilter)
    .project({ _id: 0, id: 1, name: 1 })
    .sort({ name: 1 })
    .toArray();
  const ids = applications.map(({ id }) => id);
  const rows = ids.length
    ? await database
        .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
        .aggregate([
          {
            $match: {
              workspaceId: actor.workspaceId,
              applicationId: { $in: ids },
              status: { $ne: "archived" },
            },
          },
          {
            $group: {
              _id: { applicationId: "$applicationId", status: "$status" },
              value: { $sum: 1 },
              observedAt: { $max: "$monitoringObservedAt" },
            },
          },
        ])
        .toArray()
    : [];
  const grouped = new Map();
  for (const row of rows) {
    const entry = grouped.get(row._id.applicationId) || {
      counts: {},
      observedAt: null,
    };
    entry.counts[row._id.status] = row.value;
    if (
      row.observedAt &&
      (!entry.observedAt || row.observedAt > entry.observedAt)
    )
      entry.observedAt = row.observedAt;
    grouped.set(row._id.applicationId, entry);
  }
  const items = applications.map((application) => {
    const entry = grouped.get(application.id) || { counts: {} };
    const status = healthFromCounts(entry.counts);
    return {
      ...application,
      status,
      counts: entry.counts,
      observedAt: entry.observedAt || null,
    };
  });
  return {
    kind: "health",
    ok: items.filter(({ status }) => status === "healthy").length,
    nok: items.filter(({ status }) => status !== "healthy").length,
    items,
    applicationId: configuredId || null,
  };
}

async function resolveWidgetMetric(database, actor, instance, now) {
  if (instance.widgetId === "issues-period")
    return issuePeriodMetric(database, actor, instance.config, now);
  if (instance.widgetId === "open-issues-by-application")
    return issueBreakdownMetric(database, actor, "applicationId");
  if (instance.widgetId === "open-issues-by-type")
    return issueBreakdownMetric(database, actor, "type");
  if (instance.widgetId === "pending-tasks")
    return pendingTasksMetric(database, actor);
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
  const monitoringScope = applicationScope(actor, "runtimes.read");
  const applications = hasPermission(actor, "runtimes.read")
    ? await database
        .collection(COLLECTION_NAMES.APPLICATIONS)
        .find({
          workspaceId: actor.workspaceId,
          status: { $ne: "archived" },
          ...(monitoringScope ? { id: { $in: monitoringScope } } : {}),
        })
        .project({ _id: 0, id: 1, name: 1 })
        .sort({ name: 1 })
        .toArray()
    : [];
  return {
    catalog,
    configuration,
    applications,
    data: Object.fromEntries(dataEntries),
    generatedAt: now,
  };
}
