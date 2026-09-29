import { textValue } from "../../helpers/text.js";
import { preferenceError } from "./support.js";
import { MAX_COLLECTION_ID_LENGTH, MONITORING_PANEL_WIDGET_SIZES, MAX_MONITORING_PANEL_RUNTIMES } from "./constants.js";
import { preferencesCollection } from "./storage.js";
import type { Actor } from "../../types/http.js";
import { WithId, Document } from "mongodb";
import { isRecord } from "../../helpers/records.js";

interface MonitoringWidget {
  runtimeId: string;
  size: string;
}

export function normalizeMonitoringPanelMutation(payload: unknown = {}) {
  const source = isRecord(payload) ? payload : {};
  const unknown = Object.keys(source).filter((key: string) => !["runtimeIds", "widgets"].includes(key));
  const runtimeIdValues: unknown[] | null = Array.isArray(source.runtimeIds) ? source.runtimeIds : null;
  const widgetValues: unknown[] | null = Array.isArray(source.widgets) ? source.widgets : null;
  const hasRuntimeIds = runtimeIdValues !== null;
  const hasWidgets = widgetValues !== null;
  if (unknown.length || hasRuntimeIds === hasWidgets) {
    throw preferenceError(
      422,
      "INVALID_MONITORING_PANEL_PREFERENCE",
      "Informe runtimeIds ou widgets como uma única lista sem campos adicionais",
    );
  }
  let candidates: Array<MonitoringWidget | null>;
  if (widgetValues) {
    candidates = widgetValues.map((widget) => {
      if (!isRecord(widget)) {
        return null;
      }
      const widgetUnknown = Object.keys(widget).filter((key: string) => !["runtimeId", "size"].includes(key));
      const runtimeId = textValue(widget.runtimeId || "").trim();
      const requestedSize = textValue(widget.size || "").trim();
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
    });
  } else {
    candidates = (runtimeIdValues || []).map((id) => ({
      runtimeId: textValue(id || "").trim(),
      size: "medium-2",
    }));
  }
  if (candidates.some((widget) => !widget)) {
    throw preferenceError(
      422,
      "INVALID_MONITORING_PANEL_PREFERENCE",
      "Cada widget deve informar runtimeId válido e um tamanho suportado",
    );
  }
  const widgets = [
    ...new Map<string, MonitoringWidget>(
      candidates
        .filter((widget): widget is MonitoringWidget => Boolean(widget?.runtimeId))
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

function normalizeMonitoringPanelPreference(document: WithId<Document> | null) {
  const panel = isRecord(document?.monitoringPanel) ? document.monitoringPanel : {};
  let storedWidgets: unknown[];
  if (Array.isArray(panel.widgets)) {
    storedWidgets = panel.widgets;
  } else {
    storedWidgets = (Array.isArray(panel.runtimeIds) ? panel.runtimeIds : []).map((runtimeId: unknown) => ({
      runtimeId,
      size: "medium-2",
    }));
  }
  const widgets = [
    ...new Map<string, MonitoringWidget>(
      storedWidgets
        .map((widget): [string, MonitoringWidget] | null => {
          const item = isRecord(widget) ? widget : {};
          const runtimeId = textValue(item.runtimeId || "").trim();
          const requestedSize = textValue(item.size || "").trim();
          const size = requestedSize === "medium" ? "medium-2" : requestedSize;
          return runtimeId && MONITORING_PANEL_WIDGET_SIZES.has(size) ? [runtimeId, { runtimeId, size }] : null;
        })
        .filter((entry): entry is [string, MonitoringWidget] => entry !== null),
    ).values(),
  ];
  return {
    runtimeIds: widgets.map(({ runtimeId }) => runtimeId),
    widgets,
    updatedAt: panel.updatedAt || null,
  };
}

export async function getMonitoringPanelPreference(actor: Actor) {
  const collection = await preferencesCollection();
  return normalizeMonitoringPanelPreference(
    await collection.findOne({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
    }),
  );
}

export async function updateMonitoringPanelPreference(payload: Record<string, unknown> | undefined, actor: Actor) {
  payload ??= {};

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
