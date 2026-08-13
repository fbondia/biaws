import { useCallback, useEffect, useState } from "react";

import {
  createRuntimeActiveMonitor,
  createRuntimeManualMonitoringObservation,
  deleteRuntimeActiveMonitor,
  fetchRuntimeActiveMonitors,
  fetchRuntimeMonitoringTimeline,
  fetchMonitoringTemplates,
  updateRuntimeActiveMonitor,
} from "../../../api.js";
import {
  activeMonitorDraft,
  activeMonitorPayload,
  mergeMonitoringEvents,
  newObservationDraft,
} from "./model.js";

const MONITORING_HISTORY_PAGE_SIZE = 20;

function errorMessage(error) {
  if (error?.statusCode === 409) {
    return "A configuração mudou ou está em execução. Os dados foram recarregados; revise e tente novamente.";
  }
  return error?.message || "Não foi possível concluir a operação.";
}

export function useRuntimeMonitoring({ editing, entity, kind }) {
  const runtimeId = kind === "runtime" ? entity?.id : "";
  const [activeMonitors, setActiveMonitors] = useState([]);
  const [monitoringEvents, setMonitoringEvents] = useState([]);
  const [monitoringHistoryMeta, setMonitoringHistoryMeta] = useState({
    limit: MONITORING_HISTORY_PAGE_SIZE,
    page: 1,
    total: 0,
  });
  const [monitoringHistoryLoadingMore, setMonitoringHistoryLoadingMore] =
    useState(false);
  const [monitoringTemplates, setMonitoringTemplates] = useState([]);
  const [monitoringLoading, setMonitoringLoading] = useState(
    Boolean(runtimeId),
  );
  const [monitoringError, setMonitoringError] = useState("");
  const [monitoringNotice, setMonitoringNotice] = useState("");
  const [monitorDraft, setMonitorDraft] = useState(null);
  const [monitorCreationMode, setMonitorCreationMode] = useState(null);
  const [monitorSaving, setMonitorSaving] = useState(false);
  const [monitorDeletingId, setMonitorDeletingId] = useState("");
  const [observationDraft, setObservationDraft] = useState(null);
  const [addingObservation, setAddingObservation] = useState(false);

  const loadMonitoring = useCallback(async () => {
    if (!runtimeId) return;
    setMonitoringLoading(true);
    setMonitoringError("");
    const results = await Promise.allSettled([
      fetchRuntimeActiveMonitors(runtimeId, { limit: 100 }),
      fetchRuntimeMonitoringTimeline(runtimeId, {
        limit: MONITORING_HISTORY_PAGE_SIZE,
        page: 1,
      }),
      fetchMonitoringTemplates({ limit: 100 }),
    ]);
    if (results[0].status === "fulfilled") {
      setActiveMonitors(results[0].value.items || []);
    }
    if (results[1].status === "fulfilled") {
      setMonitoringEvents(results[1].value.items || []);
      setMonitoringHistoryMeta(results[1].value.meta);
    }
    if (results[2].status === "fulfilled") {
      setMonitoringTemplates(results[2].value.items || []);
    }
    const failure = results
      .slice(0, 2)
      .find(({ status }) => status === "rejected");
    if (failure) setMonitoringError(errorMessage(failure.reason));
    setMonitoringLoading(false);
  }, [runtimeId]);

  useEffect(() => {
    if (!runtimeId) return undefined;
    let active = true;
    setMonitoringLoading(true);
    setMonitoringError("");
    Promise.allSettled([
      fetchRuntimeActiveMonitors(runtimeId, { limit: 100 }),
      fetchRuntimeMonitoringTimeline(runtimeId, {
        limit: MONITORING_HISTORY_PAGE_SIZE,
        page: 1,
      }),
      fetchMonitoringTemplates({ limit: 100 }),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") {
        setActiveMonitors(results[0].value.items || []);
      }
      if (results[1].status === "fulfilled") {
        setMonitoringEvents(results[1].value.items || []);
        setMonitoringHistoryMeta(results[1].value.meta);
      }
      if (results[2].status === "fulfilled") {
        setMonitoringTemplates(results[2].value.items || []);
      }
      const failure = results
        .slice(0, 2)
        .find(({ status }) => status === "rejected");
      if (failure) setMonitoringError(errorMessage(failure.reason));
      setMonitoringLoading(false);
    });
    return () => {
      active = false;
    };
  }, [runtimeId]);

  function openMonitor(monitor) {
    setMonitoringError("");
    setMonitoringNotice("");
    setMonitorDraft(activeMonitorDraft(monitor));
  }

  function startMonitorCreation() {
    setMonitoringError("");
    setMonitoringNotice("");
    setMonitorCreationMode("choice");
  }

  function chooseMonitorProvider(provider) {
    if (provider === "manual") {
      setMonitorCreationMode("manual");
      return;
    }
    setMonitorCreationMode(null);
    setMonitorDraft({ ...activeMonitorDraft(), provider });
  }

  async function saveMonitor() {
    if (!runtimeId || !monitorDraft) return;
    setMonitorSaving(true);
    setMonitoringError("");
    try {
      const payload = activeMonitorPayload(monitorDraft);
      const result = monitorDraft.id
        ? await updateRuntimeActiveMonitor(runtimeId, monitorDraft.id, payload)
        : await createRuntimeActiveMonitor(runtimeId, payload);
      setActiveMonitors((current) =>
        [
          ...current.filter(({ id }) => id !== result.monitor.id),
          result.monitor,
        ].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
      );
      setMonitorDraft(null);
      setMonitoringNotice(
        monitorDraft.id ? "Monitoramento atualizado." : "Monitoramento criado.",
      );
      return result.monitor;
    } catch (error) {
      setMonitoringError(errorMessage(error));
      if (error?.statusCode === 409) await loadMonitoring();
      return null;
    } finally {
      setMonitorSaving(false);
    }
  }

  async function toggleMonitor(monitor) {
    setMonitoringError("");
    try {
      const result = await updateRuntimeActiveMonitor(runtimeId, monitor.id, {
        enabled: !monitor.enabled,
      });
      setActiveMonitors((current) =>
        current.map((item) => (item.id === monitor.id ? result.monitor : item)),
      );
      setMonitoringNotice(
        result.monitor.enabled
          ? "Monitoramento ativado."
          : "Monitoramento desativado.",
      );
    } catch (error) {
      setMonitoringError(errorMessage(error));
      if (error?.statusCode === 409) await loadMonitoring();
    }
  }

  async function removeMonitor(monitor) {
    if (!window.confirm(`Arquivar o monitoramento “${monitor.name}”?`)) return;
    setMonitorDeletingId(monitor.id);
    setMonitoringError("");
    try {
      await deleteRuntimeActiveMonitor(runtimeId, monitor.id);
      setActiveMonitors((current) =>
        current.filter(({ id }) => id !== monitor.id),
      );
      setMonitoringNotice("Monitoramento arquivado.");
    } catch (error) {
      setMonitoringError(errorMessage(error));
      if (error?.statusCode === 409) await loadMonitoring();
    } finally {
      setMonitorDeletingId("");
    }
  }

  function openObservation() {
    setMonitoringError("");
    setMonitoringNotice("");
    setObservationDraft(newObservationDraft());
  }

  async function loadMoreMonitoringEvents() {
    if (
      !runtimeId ||
      monitoringHistoryLoadingMore ||
      monitoringEvents.length >= monitoringHistoryMeta.total
    ) {
      return;
    }
    setMonitoringHistoryLoadingMore(true);
    setMonitoringError("");
    try {
      const result = await fetchRuntimeMonitoringTimeline(runtimeId, {
        limit: monitoringHistoryMeta.limit || MONITORING_HISTORY_PAGE_SIZE,
        page: monitoringHistoryMeta.page + 1,
      });
      setMonitoringEvents((current) =>
        mergeMonitoringEvents(current, result.items || []),
      );
      setMonitoringHistoryMeta(result.meta);
    } catch (error) {
      setMonitoringError(errorMessage(error));
    } finally {
      setMonitoringHistoryLoadingMore(false);
    }
  }

  async function addObservation() {
    if (!editing || !runtimeId || !observationDraft?.observedAt) return;
    setAddingObservation(true);
    setMonitoringError("");
    try {
      const result = await createRuntimeManualMonitoringObservation(runtimeId, {
        status: observationDraft.healthStatus,
        observedAt: new Date(observationDraft.observedAt).toISOString(),
        source: observationDraft.source.trim() || "manual",
        message: observationDraft.message.trim(),
        metadata: {},
      });
      setMonitoringEvents((current) =>
        mergeMonitoringEvents([result.signal], current),
      );
      setMonitoringHistoryMeta((current) => ({
        ...current,
        total: current.total + 1,
      }));
      setObservationDraft(null);
      setMonitoringNotice("Observação manual registrada.");
    } catch (error) {
      setMonitoringError(errorMessage(error));
    } finally {
      setAddingObservation(false);
    }
  }

  return {
    activeMonitors,
    addObservation,
    addingObservation,
    closeMonitor: () => setMonitorDraft(null),
    closeMonitorCreation: () => setMonitorCreationMode(null),
    closeObservation: () => setObservationDraft(null),
    loadMonitoring,
    loadMoreMonitoringEvents,
    monitorDeletingId,
    monitorCreationMode,
    monitorDraft,
    monitorSaving,
    monitoringError,
    monitoringEvents,
    monitoringHistoryHasMore:
      monitoringEvents.length < monitoringHistoryMeta.total,
    monitoringHistoryLoadingMore,
    monitoringLoading,
    monitoringNotice,
    monitoringTemplates,
    observationDraft,
    openMonitor,
    openObservation,
    removeMonitor,
    saveMonitor,
    selectMonitorProvider: chooseMonitorProvider,
    setMonitorDraft,
    setObservationDraft,
    showMonitorProviderChoice: () => setMonitorCreationMode("choice"),
    startMonitorCreation,
    toggleMonitor,
  };
}
