import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { RuntimeMonitoringConfiguration } from "../../src/components/catalog/CatalogEntityDialog/components/RuntimeMonitoring/index.jsx";
import { activeMonitorDraft } from "../../src/components/catalog/CatalogEntityDialog/runtimeMonitoringModel.js";

export function RuntimeMonitoringHarness() {
  const [monitorDraft, setMonitorDraft] = useState(null);
  const [retention, setRetention] = useState(10);
  const controller = {
    activeMonitors: [],
    closeMonitor: () => setMonitorDraft(null),
    loadMonitoring() {},
    monitorDeletingId: "",
    monitorDraft,
    monitorSaving: false,
    monitoringError: "",
    monitoringLoading: false,
    monitoringNotice: "",
    openMonitor: () => setMonitorDraft(activeMonitorDraft()),
    removeMonitor() {},
    saveMonitor() {},
    setMonitorDraft,
    toggleMonitor() {},
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
