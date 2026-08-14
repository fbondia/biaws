import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

export const COLLECTION_NAVIGATION_CONTEXTS = Object.freeze([
  "applications",
  "documents",
  "demands",
  "secrets",
  "skills",
  "servers",
]);

const MAX_COLLECTION_ID_LENGTH = 200;
const MAX_MONITORING_PANEL_RUNTIMES = 100;
const MONITORING_PANEL_WIDGET_SIZES = new Set([
  "small",
  "medium-1",
  "medium-2",
  "large",
]);
let collectionPromise;

function preferenceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function assertCollectionNavigationContext(value) {
  const context = String(value || "").trim();
  if (!COLLECTION_NAVIGATION_CONTEXTS.includes(context)) {
    throw preferenceError(
      404,
      "COLLECTION_NAVIGATION_CONTEXT_NOT_FOUND",
      `Contexto de navegação não suportado: ${context}`,
    );
  }
  return context;
}

function normalizeCollectionId(value) {
  const collectionId = String(value || "").trim();
  if (!collectionId || collectionId.length > MAX_COLLECTION_ID_LENGTH) {
    throw preferenceError(
      422,
      "INVALID_COLLECTION_NAVIGATION_PREFERENCE",
      `collectionId deve conter entre 1 e ${MAX_COLLECTION_ID_LENGTH} caracteres`,
    );
  }
  return collectionId;
}

export function normalizeCollectionNavigationMutation(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const unknown = Object.keys(source).filter(
    (key) => !["collectionId", "collapsed"].includes(key),
  );
  if (unknown.length) {
    throw preferenceError(
      422,
      "INVALID_COLLECTION_NAVIGATION_PREFERENCE",
      `Campos de preferência desconhecidos: ${unknown.join(", ")}`,
    );
  }
  if (typeof source.collapsed !== "boolean") {
    throw preferenceError(
      422,
      "INVALID_COLLECTION_NAVIGATION_PREFERENCE",
      "collapsed deve ser booleano",
    );
  }
  return {
    collectionId: normalizeCollectionId(source.collectionId),
    collapsed: source.collapsed,
  };
}

function normalizePreference(context, document) {
  const preference = document?.collectionNavigation?.[context] || {};
  return {
    context,
    collapsedCollectionIds: [
      ...new Set(
        (preference.collapsedCollectionIds || [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    ],
    updatedAt: preference.updatedAt || null,
  };
}

async function preferencesCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const database = await getMongoDatabase();
      const collection = database.collection(COLLECTION_NAMES.USER_PREFERENCES);
      await Promise.all([
        collection.createIndex(
          { workspaceId: 1, userId: 1 },
          { unique: true, name: "workspace_user_preferences_unique" },
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

export async function getCollectionNavigationPreference(contextValue, actor) {
  const context = assertCollectionNavigationContext(contextValue);
  const collection = await preferencesCollection();
  const document = await collection.findOne({
    workspaceId: actor.workspaceId,
    userId: actor.userId,
  });
  return normalizePreference(context, document);
}

export function buildCollectionNavigationUpdateOperation(
  contextValue,
  payload,
  actor,
  now = new Date(),
) {
  const context = assertCollectionNavigationContext(contextValue);
  const { collectionId, collapsed } =
    normalizeCollectionNavigationMutation(payload);
  const collapsedPath = `collectionNavigation.${context}.collapsedCollectionIds`;
  const contextUpdatedAtPath = `collectionNavigation.${context}.updatedAt`;

  return {
    context,
    filter: { workspaceId: actor.workspaceId, userId: actor.userId },
    update: {
      [collapsed ? "$addToSet" : "$pull"]: {
        [collapsedPath]: collectionId,
      },
      $set: {
        [contextUpdatedAtPath]: now,
        updatedAt: now,
        updatedBy: actor.userId,
      },
      $setOnInsert: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        createdAt: now,
      },
    },
  };
}

export async function updateCollectionNavigationPreference(
  contextValue,
  payload,
  actor,
) {
  const collection = await preferencesCollection();
  const now = new Date();
  const operation = buildCollectionNavigationUpdateOperation(
    contextValue,
    payload,
    actor,
    now,
  );

  await collection.updateOne(operation.filter, operation.update, {
    upsert: true,
  });

  const document = await collection.findOne(operation.filter);
  return normalizePreference(operation.context, document);
}

export function normalizeMonitoringPanelMutation(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const unknown = Object.keys(source).filter(
    (key) => !["runtimeIds", "widgets"].includes(key),
  );
  const hasRuntimeIds = Array.isArray(source.runtimeIds);
  const hasWidgets = Array.isArray(source.widgets);
  if (unknown.length || hasRuntimeIds === hasWidgets) {
    throw preferenceError(
      422,
      "INVALID_MONITORING_PANEL_PREFERENCE",
      "Informe runtimeIds ou widgets como uma única lista sem campos adicionais",
    );
  }
  const candidates = hasWidgets
    ? source.widgets.map((widget) => {
        if (!widget || typeof widget !== "object" || Array.isArray(widget)) {
          return null;
        }
        const widgetUnknown = Object.keys(widget).filter(
          (key) => !["runtimeId", "size"].includes(key),
        );
        const runtimeId = String(widget.runtimeId || "").trim();
        const requestedSize = String(widget.size || "").trim();
        const size = requestedSize === "medium" ? "medium-2" : requestedSize;
        if (
          widgetUnknown.length ||
          !runtimeId ||
          runtimeId.length > MAX_COLLECTION_ID_LENGTH ||
          !MONITORING_PANEL_WIDGET_SIZES.has(size)
        ) {
          return null;
        }
        return { runtimeId, size };
      })
    : source.runtimeIds.map((id) => ({
        runtimeId: String(id || "").trim(),
        size: "medium-2",
      }));
  if (candidates.some((widget) => !widget)) {
    throw preferenceError(
      422,
      "INVALID_MONITORING_PANEL_PREFERENCE",
      "Cada widget deve informar runtimeId válido e um tamanho suportado",
    );
  }
  const widgets = [
    ...new Map(
      candidates
        .filter(({ runtimeId }) => runtimeId)
        .map((widget) => [widget.runtimeId, widget]),
    ).values(),
  ];
  const runtimeIds = widgets.map(({ runtimeId }) => runtimeId);
  if (
    runtimeIds.length > MAX_MONITORING_PANEL_RUNTIMES ||
    runtimeIds.some((id) => id.length > MAX_COLLECTION_ID_LENGTH)
  ) {
    throw preferenceError(
      422,
      "INVALID_MONITORING_PANEL_PREFERENCE",
      `runtimeIds aceita no máximo ${MAX_MONITORING_PANEL_RUNTIMES} identificadores válidos`,
    );
  }
  return { runtimeIds, widgets };
}

function normalizeMonitoringPanelPreference(document) {
  const storedWidgets = Array.isArray(document?.monitoringPanel?.widgets)
    ? document.monitoringPanel.widgets
    : (document?.monitoringPanel?.runtimeIds || []).map((runtimeId) => ({
        runtimeId,
        size: "medium-2",
      }));
  const widgets = [
    ...new Map(
      storedWidgets
        .map((widget) => {
          const runtimeId = String(widget?.runtimeId || "").trim();
          const requestedSize = String(widget?.size || "").trim();
          const size = requestedSize === "medium" ? "medium-2" : requestedSize;
          return runtimeId && MONITORING_PANEL_WIDGET_SIZES.has(size)
            ? [runtimeId, { runtimeId, size }]
            : null;
        })
        .filter(Boolean),
    ).values(),
  ];
  return {
    runtimeIds: widgets.map(({ runtimeId }) => runtimeId),
    widgets,
    updatedAt: document?.monitoringPanel?.updatedAt || null,
  };
}

export async function getMonitoringPanelPreference(actor) {
  const collection = await preferencesCollection();
  return normalizeMonitoringPanelPreference(
    await collection.findOne({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
    }),
  );
}

export async function updateMonitoringPanelPreference(payload, actor) {
  const { runtimeIds, widgets } = normalizeMonitoringPanelMutation(payload);
  const collection = await preferencesCollection();
  const now = new Date();
  const filter = { workspaceId: actor.workspaceId, userId: actor.userId };
  await collection.updateOne(
    filter,
    {
      $set: {
        "monitoringPanel.runtimeIds": runtimeIds,
        "monitoringPanel.widgets": widgets,
        "monitoringPanel.updatedAt": now,
        updatedAt: now,
        updatedBy: actor.userId,
      },
      $setOnInsert: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return { runtimeIds, widgets, updatedAt: now };
}
