import { randomUUID } from "node:crypto";

import { DEPLOYMENT_ENVIRONMENTS } from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { getPagination } from "../helpers/query.js";
import { actorCanAccessApplication } from "../auth/authorizationMiddleware.js";
import { monitoringMetadataPresentation } from "./monitoringMetadataProfiles.js";

const MAX_WIDGETS = 30;
const DEFAULT_PENDING_TASKS_LIMIT = 6;
const WIDGET_SIZES = new Set(["small", "medium-1", "medium-2", "large"]);
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
    defaultSize: "medium-2",
    configuration: { fields: [] },
  },
  {
    id: "open-issues-by-type",
    category: "Chamados",
    label: "Chamados abertos por tipo",
    description: "Distribuição dos chamados em aberto por tipo.",
    permission: "issues.read",
    defaultSize: "medium-2",
    configuration: { fields: [] },
  },
  {
    id: "pending-tasks",
    category: "Melhorias",
    label: "Tarefas pendentes",
    description: "Tarefas ainda não concluídas nas melhorias acessíveis.",
    permission: "demands.read",
    defaultSize: "medium-2",
    configuration: { fields: [] },
  },
  {
    id: "application-health",
    category: "Monitoramento",
    label: "Saúde das aplicações",
    description:
      "Runtimes monitorados agrupados por aplicação, componente e deployment.",
    permission: "runtimes.read",
    defaultSize: "medium-2",
    configuration: {
      fields: [
        {
          key: "applicationId",
          label: "Aplicação",
          type: "application",
          required: false,
          emptyLabel: "Todas as aplicações",
        },
        {
          key: "environment",
          label: "Ambiente do deployment",
          type: "select",
          required: false,
          emptyLabel: "Todos os ambientes",
          options: [
            { value: "development", label: "Desenvolvimento" },
            { value: "test", label: "Teste" },
            { value: "staging", label: "Homologação" },
            { value: "production", label: "Produção" },
            { value: "other", label: "Outro" },
          ],
        },
        {
          key: "componentId",
          label: "Componente",
          type: "component",
          required: false,
          emptyLabel: "Todos os componentes",
        },
        {
          key: "deploymentId",
          label: "Deployment",
          type: "deployment",
          required: false,
          emptyLabel: "Todos os deployments",
        },
        {
          key: "runtimeId",
          label: "Runtime",
          type: "runtime",
          required: false,
          emptyLabel: "Todos os runtimes",
        },
        {
          key: "presentation",
          label: "Apresentação",
          type: "select",
          required: true,
          options: [
            { value: "list", label: "Lista" },
            { value: "tabs", label: "Abas" },
          ],
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

function normalizeIssuesPeriodConfiguration(value) {
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

function normalizeApplicationHealthConfiguration(value) {
  const environment = String(value.environment || "").trim();
  const applicationId = String(value.applicationId || "").trim();
  const componentId = String(value.componentId || "").trim();
  const deploymentId = String(value.deploymentId || "").trim();
  const runtimeId = String(value.runtimeId || "").trim();
  const requestedPresentation = String(value.presentation || "list").trim();
  if (environment && !DEPLOYMENT_ENVIRONMENTS.includes(environment)) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      `environment must be one of: ${DEPLOYMENT_ENVIRONMENTS.join(", ")}`,
    );
  }
  if (!["list", "tabs"].includes(requestedPresentation)) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "presentation must be list or tabs",
    );
  }
  if (
    (componentId && !applicationId) ||
    (deploymentId && !componentId) ||
    (runtimeId && !deploymentId)
  ) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "application health filters must follow application, component, deployment and runtime hierarchy",
    );
  }
  return {
    applicationId,
    componentId,
    deploymentId,
    environment,
    presentation: runtimeId ? "tabs" : requestedPresentation,
    runtimeId,
  };
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
    return normalizeIssuesPeriodConfiguration(value);
  }
  if (widget.id === "application-health") {
    return normalizeApplicationHealthConfiguration(value);
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
    const requestedSize = String(item.size || widget.defaultSize);
    const size = requestedSize === "medium" ? "medium-2" : requestedSize;
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
    ["open-issues-by-application", {}, "medium-2"],
    ["open-issues-by-type", {}, "medium-2"],
    ["pending-tasks", {}, "medium-2"],
    [
      "application-health",
      {
        applicationId: "",
        componentId: "",
        deploymentId: "",
        environment: "",
        presentation: "list",
        runtimeId: "",
      },
      "medium-2",
    ],
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

function configuredApplicationIds(widgets) {
  return [
    ...new Set(
      widgets
        .map(({ config }) => config.applicationId)
        .filter(Boolean)
        .map(String),
    ),
  ];
}

function assertConfiguredApplicationAccess(widgets, actor) {
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
}

function configuredMonitoringTargets(config) {
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
  ].filter(Boolean);
}

async function assertMonitoringTargetAvailable(database, target, workspaceId) {
  const available = await database
    .collection(target.collection)
    .countDocuments({
      workspaceId,
      status: { $ne: "archived" },
      ...target.filter,
    });
  if (available !== 1) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "configured monitoring target is unavailable",
    );
  }
}

async function assertConfiguredMonitoringTargets(database, widgets, actor) {
  const healthWidgets = widgets.filter(
    ({ widgetId }) => widgetId === "application-health",
  );
  for (const instance of healthWidgets) {
    const targets = configuredMonitoringTargets(instance.config);
    for (const target of targets) {
      await assertMonitoringTargetAvailable(
        database,
        target,
        actor.workspaceId,
      );
    }
  }
}

async function validateConfiguredApplications(widgets, actor) {
  assertConfiguredApplicationAccess(widgets, actor);
  const applicationIds = configuredApplicationIds(widgets);
  if (!applicationIds.length) return;
  const database = await getMongoDatabase();
  const applicationCount = await database
    .collection(COLLECTION_NAMES.APPLICATIONS)
    .countDocuments({
      workspaceId: actor.workspaceId,
      id: { $in: applicationIds },
      status: { $ne: "archived" },
    });
  if (applicationCount !== applicationIds.length) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "configured application is unavailable",
    );
  }
  await assertConfiguredMonitoringTargets(database, widgets, actor);
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
  await validateConfiguredApplications(widgets, actor);
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

export function pendingTasksPagination(query = {}) {
  const requestedLimit = String(query.limit ?? "").trim()
    ? query.limit
    : DEFAULT_PENDING_TASKS_LIMIT;
  return getPagination({ ...query, limit: requestedLimit });
}

export async function buildPendingTasksMetric(database, actor, query = {}) {
  const pagination = pendingTasksPagination(query);
  const requests = await database
    .collection(COLLECTION_NAMES.REQUESTS)
    .find(scopedFilter(actor, "demands.read"))
    .project({ _id: 1, clientCode: 1, title: 1 })
    .toArray();
  const requestIds = requests.map(({ _id }) => _id);
  if (!requestIds.length) {
    return {
      kind: "tasks",
      value: 0,
      items: [],
      page: pagination.page,
      limit: pagination.limit,
      hasMore: false,
    };
  }
  const filter = {
    requestId: { $in: requestIds },
    status: { $nin: COMPLETED_TASK_STATUSES },
  };
  const [value, tasks] = await Promise.all([
    database.collection(COLLECTION_NAMES.REQUEST_TASKS).countDocuments(filter),
    database
      .collection(COLLECTION_NAMES.REQUEST_TASKS)
      .find(filter)
      .sort({ endDate: 1, createdAt: -1, _id: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
  ]);
  const requestDetails = new Map(
    requests.map(({ _id, clientCode, title }) => [
      _id.toString(),
      { clientCode: clientCode || "", title: title || "Melhoria" },
    ]),
  );
  return {
    kind: "tasks",
    value,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.skip + tasks.length < value,
    items: tasks.map((task) => {
      const request = requestDetails.get(task.requestId?.toString()) || {};
      return {
        id: task._id.toString(),
        code: task.code || "",
        requestId: task.requestId?.toString() || "",
        requestCode: request.clientCode || "",
        title: task.title,
        status: task.status,
        endDate: task.endDate || "",
        requestTitle: request.title || "Melhoria",
      };
    }),
  };
}

export async function getPendingTasksMetric(actor, query = {}) {
  const database = await getMongoDatabase();
  return buildPendingTasksMetric(database, actor, query);
}

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
          metadata: latestSignal.metadata || {},
          ...(latestSignal.metadataProfile
            ? { metadataProfile: latestSignal.metadataProfile }
            : {}),
          ...(metadataPresentation ? { metadataPresentation } : {}),
        }
      : null,
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
        serversById,
      ),
    );
  }

  return [...grouped.values()]
    .map(materializeApplicationHealth)
    .sort(compareNamedItems);
}

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
          metadata: "$signal.metadata",
          metadataProfile: "$signal.metadataProfile",
          metadataPresentation: "$signal.metadataPresentation",
          templatePresentation: "$signal.templateSnapshot.presentation",
        },
      },
    ])
    .toArray();
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
  const configuredRuntimeIds = config.includeConfigured
    ? await database
        .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
        .distinct("runtimeId", {
          workspaceId: actor.workspaceId,
          applicationId: { $in: ids },
          archivedAt: { $exists: false },
        })
    : [];
  const runtimes = ids.length
    ? await database
        .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
        .find({
          workspaceId: actor.workspaceId,
          applicationId: { $in: ids },
          ...(config.componentId ? { componentId: config.componentId } : {}),
          ...(config.deploymentId ? { deploymentId: config.deploymentId } : {}),
          ...(config.runtimeId ? { id: config.runtimeId } : {}),
          status: { $ne: "archived" },
          ...(config.includeConfigured
            ? {
                $or: [
                  { monitoring: { $exists: true, $ne: null } },
                  { id: { $in: configuredRuntimeIds } },
                ],
              }
            : { monitoring: { $exists: true, $ne: null } }),
        })
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
        .toArray()
    : [];
  const componentIds = [
    ...new Set(runtimes.map(({ componentId }) => componentId)),
  ];
  const deploymentIds = [
    ...new Set(runtimes.map(({ deploymentId }) => deploymentId)),
  ];
  const serverIds = [
    ...new Set(runtimes.map(({ serverId }) => serverId).filter(Boolean)),
  ];
  const [components, deployments, servers] = await Promise.all([
    componentIds.length
      ? database
          .collection(COLLECTION_NAMES.APPLICATION_COMPONENTS)
          .find({
            workspaceId: actor.workspaceId,
            applicationId: { $in: ids },
            id: { $in: componentIds },
          })
          .project({ _id: 0, id: 1, key: 1, name: 1 })
          .toArray()
      : [],
    deploymentIds.length
      ? database
          .collection(COLLECTION_NAMES.APPLICATION_DEPLOYMENTS)
          .find({
            workspaceId: actor.workspaceId,
            applicationId: { $in: ids },
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
          .find({ workspaceId: actor.workspaceId, id: { $in: serverIds } })
          .project({ _id: 0, id: 1, key: 1, name: 1 })
          .toArray()
      : [],
  ]);
  const filteredRuntimes = filterRuntimesByDeploymentEnvironment(
    runtimes,
    deployments,
    config.environment,
  );
  const latestSignals = await latestRuntimeMonitoringSignals(
    database,
    actor.workspaceId,
    filteredRuntimes.map(({ id }) => id),
  );
  const items = buildApplicationHealthItems({
    applications,
    components,
    deployments,
    latestSignals,
    runtimes: filteredRuntimes.map((runtime) =>
      config.includeConfigured && !runtime.monitoring
        ? { ...runtime, status: "unknown" }
        : runtime,
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

function monitoringRuntimeItem({ id, name }) {
  return { id, name };
}

function monitoringDeploymentItem(
  deployment,
  runtimes,
  applicationId,
  componentId,
) {
  const relatedRuntimes = runtimes.filter(
    (runtime) =>
      runtime.applicationId === applicationId &&
      runtime.componentId === componentId &&
      runtime.deploymentId === deployment.id,
  );
  return {
    id: deployment.id,
    name: deployment.name,
    runtimes: relatedRuntimes.map(monitoringRuntimeItem),
  };
}

function monitoringComponentItem(
  component,
  deployments,
  runtimes,
  applicationId,
) {
  const relatedDeployments = deployments.filter(
    (deployment) =>
      deployment.applicationId === applicationId &&
      deployment.componentId === component.id,
  );
  return {
    id: component.id,
    name: component.name,
    deployments: relatedDeployments.map((deployment) =>
      monitoringDeploymentItem(
        deployment,
        runtimes,
        applicationId,
        component.id,
      ),
    ),
  };
}

function monitoringApplicationItem(
  application,
  components,
  deployments,
  runtimes,
) {
  const relatedComponents = components.filter(
    ({ applicationId }) => applicationId === application.id,
  );
  return {
    ...application,
    components: relatedComponents.map((component) =>
      monitoringComponentItem(component, deployments, runtimes, application.id),
    ),
  };
}

async function homeMonitoringApplications(database, actor) {
  if (!hasPermission(actor, "runtimes.read")) return [];
  const monitoringScope = applicationScope(actor, "runtimes.read");
  const applications = await database
    .collection(COLLECTION_NAMES.APPLICATIONS)
    .find({
      workspaceId: actor.workspaceId,
      status: { $ne: "archived" },
      ...(monitoringScope ? { id: { $in: monitoringScope } } : {}),
    })
    .project({ _id: 0, id: 1, name: 1 })
    .sort({ name: 1 })
    .toArray();
  const applicationIds = applications.map(({ id }) => id);
  if (!applicationIds.length) return applications;
  const runtimes = await database
    .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
    .find({
      workspaceId: actor.workspaceId,
      applicationId: { $in: applicationIds },
      status: { $ne: "archived" },
      monitoring: { $exists: true, $ne: null },
    })
    .project({
      _id: 0,
      id: 1,
      name: 1,
      applicationId: 1,
      componentId: 1,
      deploymentId: 1,
    })
    .sort({ name: 1 })
    .toArray();
  const componentIds = [
    ...new Set(runtimes.map(({ componentId }) => componentId)),
  ];
  const deploymentIds = [
    ...new Set(runtimes.map(({ deploymentId }) => deploymentId)),
  ];
  const [components, deployments] = await Promise.all([
    componentIds.length
      ? database
          .collection(COLLECTION_NAMES.APPLICATION_COMPONENTS)
          .find({
            workspaceId: actor.workspaceId,
            id: { $in: componentIds },
            status: { $ne: "archived" },
          })
          .project({ _id: 0, id: 1, name: 1, applicationId: 1 })
          .sort({ name: 1 })
          .toArray()
      : [],
    deploymentIds.length
      ? database
          .collection(COLLECTION_NAMES.APPLICATION_DEPLOYMENTS)
          .find({
            workspaceId: actor.workspaceId,
            id: { $in: deploymentIds },
            status: { $ne: "archived" },
          })
          .project({
            _id: 0,
            id: 1,
            name: 1,
            applicationId: 1,
            componentId: 1,
          })
          .sort({ name: 1 })
          .toArray()
      : [],
  ]);
  return applications.map((application) =>
    monitoringApplicationItem(application, components, deployments, runtimes),
  );
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
