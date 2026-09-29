import { preferenceError } from "./support.js";
import {
  MAX_COLLECTION_ID_LENGTH,
  MONITORING_PANEL_WIDGET_SIZES,
  MAX_MONITORING_PANEL_RUNTIMES,
} from "./constants.js";
import { preferencesCollection } from "./storage.js";

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
