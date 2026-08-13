import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import {
  RuntimeMonitoringConfiguration,
  RuntimeMonitoringHistory,
  RuntimeMonitoringTabs,
} from "../../src/components/catalog/CatalogEntityDialog/components/RuntimeMonitoring/index.jsx";
import { activeMonitorDraft } from "../../src/components/catalog/CatalogEntityDialog/runtimeMonitoringModel.js";

export function RuntimeMonitoringHarness() {
  const [monitorDraft, setMonitorDraft] = useState(null);
  const [monitorCreationMode, setMonitorCreationMode] = useState(null);
  const [retention, setRetention] = useState(10);
  const controller = {
    activeMonitors: [],
    closeMonitor: () => setMonitorDraft(null),
    closeMonitorCreation: () => setMonitorCreationMode(null),
    cliExample: "biaws monitoring signal runtime-1 --workspace workspace-1",
    curlExample: "curl https://biaws.example.test/api/monitoring/runtime-1",
    entity: { id: "runtime-1", key: "primary", name: "Runtime" },
    loadMonitoring() {},
    monitorDeletingId: "",
    monitorCreationMode,
    monitorDraft,
    monitorSaving: false,
    monitoringError: "",
    monitoringLoading: false,
    monitoringNotice: "",
    monitoringTemplates: [
      {
        id: "health-template",
        name: "Saúde HTTP",
        versions: [
          { status: "inactive", version: "1" },
          { status: "active", version: "2" },
        ],
      },
    ],
    openMonitor: (monitor) => setMonitorDraft(activeMonitorDraft(monitor)),
    removeMonitor() {},
    saveMonitor() {},
    selectMonitorProvider: (provider) => {
      if (provider === "manual") {
        setMonitorCreationMode("manual");
        return;
      }
      setMonitorCreationMode(null);
      setMonitorDraft({ ...activeMonitorDraft(), provider });
    },
    setMonitorDraft,
    showMonitorProviderChoice: () => setMonitorCreationMode("choice"),
    startMonitorCreation: () => setMonitorCreationMode("choice"),
    toggleMonitor() {},
    runtimePath: "biaws.api.production.primary",
  };
  return (
    <RuntimeMonitoringConfiguration
      controller={controller}
      draft={{ monitoringRetentionDays: retention }}
      editing
      options={{ canUpdateRuntime: true }}
      update={(_name, value) => setRetention(value)}
    />
  );
}

export function mountRuntimeMonitoring(element) {
  const root = createRoot(element);
  flushSync(() => root.render(<RuntimeMonitoringHarness />));
  return root;
}

export function RuntimeMonitoringTabsHarness() {
  const [events, setEvents] = useState([
    {
      id: "event-1",
      observedAt: "2026-08-13T12:00:00.000Z",
      origin: "passive",
      status: "healthy",
    },
  ]);
  const controller = {
    addingObservation: false,
    loadMoreMonitoringEvents: () =>
      setEvents((current) => [
        ...current,
        {
          id: "event-2",
          observedAt: "2026-08-13T11:00:00.000Z",
          origin: "active",
          status: "healthy",
        },
      ]),
    monitoringError: "",
    monitoringEvents: events,
    monitoringHistoryHasMore: events.length < 2,
    monitoringHistoryLoadingMore: false,
    monitoringLoading: false,
    monitoringNotice: "",
    observationDraft: null,
    openObservation() {},
    setObservationDraft() {},
  };
  return (
    <RuntimeMonitoringTabs
      configuration={<div>Conteúdo de configurações</div>}
      history={
        <RuntimeMonitoringHistory
          controller={controller}
          editing
          entity={{ id: "runtime-1", name: "Runtime" }}
          options={{ canUpdateRuntime: false }}
        />
      }
    />
  );
}

export function mountRuntimeMonitoringTabs(element) {
  const root = createRoot(element);
  flushSync(() => root.render(<RuntimeMonitoringTabsHarness />));
  return root;
}
