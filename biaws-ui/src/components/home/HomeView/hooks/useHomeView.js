import { useEffect, useRef, useState } from "react";

import {
  fetchHomeDashboard,
  updateHomeConfiguration,
} from "../../../../api.js";
import {
  createWidgetInstance,
  moveWidget,
  updateWidgetInstance,
} from "../model.js";
import {
  MONITORING_REFRESH_INTERVAL_MS,
  useAutoRefresh,
} from "../../../../hooks/useAutoRefresh.js";

export function useHomeView() {
  const [dashboard, setDashboard] = useState(null);
  const [draftWidgets, setDraftWidgets] = useState([]);
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [monitoringRuntime, setMonitoringRuntime] = useState(null);
  const [draggingId, setDraggingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const loadPromiseRef = useRef(null);
  const hasMonitoringWidgets = Boolean(
    dashboard?.configuration.widgets?.some(
      ({ widgetId }) => widgetId === "application-health",
    ),
  );

  async function load() {
    if (loadPromiseRef.current) return loadPromiseRef.current;
    setLoading(true);
    setError("");
    const promise = fetchHomeDashboard()
      .then((payload) => setDashboard(payload))
      .catch((loadError) => setError(loadError.message))
      .finally(() => {
        loadPromiseRef.current = null;
        setLoading(false);
      });
    loadPromiseRef.current = promise;
    return promise;
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchHomeDashboard()
      .then((payload) => {
        if (active) setDashboard(payload);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useAutoRefresh(load, {
    enabled:
      hasMonitoringWidgets &&
      !editing &&
      !catalogOpen &&
      !configuration &&
      !monitoringRuntime &&
      !saving,
    intervalMs: MONITORING_REFRESH_INTERVAL_MS,
  });

  function beginEditing() {
    setDraftWidgets(structuredClone(dashboard.configuration.widgets));
    setEditing(true);
  }

  function addWidget(definition) {
    const instance = createWidgetInstance(definition, {});
    if (definition.configuration?.fields?.length) {
      setConfiguration({ definition, instance, creating: true });
    } else {
      setDraftWidgets((current) => [...current, instance]);
    }
    setCatalogOpen(false);
  }

  function applyConfiguration(config) {
    const { instance, creating } = configuration;
    if (creating) {
      setDraftWidgets((current) => [...current, { ...instance, config }]);
    } else {
      setDraftWidgets((current) =>
        updateWidgetInstance(current, instance.id, { config }),
      );
    }
    setConfiguration(null);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = await updateHomeConfiguration(draftWidgets);
      setDashboard(payload);
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function dropWidget(targetId) {
    if (editing && draggingId) {
      setDraftWidgets((current) => moveWidget(current, draggingId, targetId));
    }
    setDraggingId("");
  }

  function resizeWidget(id, size) {
    setDraftWidgets((current) => updateWidgetInstance(current, id, { size }));
  }

  function removeWidget(id) {
    setDraftWidgets((current) =>
      current.filter((instance) => instance.id !== id),
    );
  }

  function configureWidget(definition, instance) {
    setConfiguration({ definition, instance, creating: false });
  }

  const widgets = editing
    ? draftWidgets
    : dashboard?.configuration.widgets || [];
  const catalogById = new Map(
    (dashboard?.catalog || []).map((item) => [item.id, item]),
  );

  return {
    addWidget,
    applyConfiguration,
    beginEditing,
    catalogById,
    catalogOpen,
    configuration,
    configureWidget,
    dashboard,
    draggingId,
    dropWidget,
    editing,
    error,
    load,
    loading,
    monitoringRuntime,
    removeWidget,
    resizeWidget,
    save,
    saving,
    setCatalogOpen,
    setConfiguration,
    setDraggingId,
    setEditing,
    setMonitoringRuntime,
    widgets,
  };
}
