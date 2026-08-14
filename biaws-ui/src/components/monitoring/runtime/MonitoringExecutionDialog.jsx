import { LoaderCircle, Play, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  fetchRuntimeActiveMonitors,
  requestRuntimeActiveMonitorExecution,
} from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh.js";
import "../../../styles/features/monitoring-execution.css";

export function canRequestMonitoringExecution(actor, applicationId) {
  if (!hasPermission(actor, "monitoring.active.request")) return false;
  const scope = actor.permissionScopes?.["monitoring.active.request"];
  return Boolean(
    scope?.workspace || scope?.applicationIds?.includes(applicationId),
  );
}

export function MonitoringExecutionDialog({ onClose, onRequested, target }) {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestingId, setRequestingId] = useState("");

  const loadMonitors = useCallback(async () => {
    const payload = await fetchRuntimeActiveMonitors(target.id, { limit: 50 });
    setMonitors(payload.items || []);
    setError("");
  }, [target.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void loadMonitors()
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadMonitors]);

  useAutoRefresh(loadMonitors);

  async function requestExecution(monitor) {
    setRequestingId(monitor.id);
    setError("");
    try {
      const result = await requestRuntimeActiveMonitorExecution(
        target.id,
        monitor.id,
      );
      setMonitors((current) =>
        current.map((item) =>
          item.id === monitor.id
            ? { ...item, pendingExecution: result.execution }
            : item,
        ),
      );
      onRequested({ monitor, result, target });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRequestingId("");
    }
  }

  const enabledMonitors = monitors.filter(({ enabled }) => enabled);
  return (
    <div className="dialogBackdrop" role="presentation">
      <section
        aria-labelledby="monitoring-execution-title"
        aria-modal="true"
        className="monitoringExecutionDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Execução imediata</span>
            <h2 id="monitoring-execution-title">{target.name}</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            disabled={Boolean(requestingId)}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="monitoringExecutionDialogBody">
          {loading ? (
            <div className="homeWidgetPending">Carregando monitores…</div>
          ) : null}
          {error ? (
            <div className="errorBox" role="alert">
              {error}
            </div>
          ) : null}
          {!loading ? (
            <div className="monitoringExecutionList">
              {enabledMonitors.map((monitor) => (
                <button
                  disabled={
                    Boolean(requestingId) || Boolean(monitor.pendingExecution)
                  }
                  key={monitor.id}
                  onClick={() => requestExecution(monitor)}
                  type="button"
                >
                  <span>
                    <strong>{monitor.name}</strong>
                    <small>
                      {monitor.pendingExecution
                        ? monitor.pendingExecution.status === "running"
                          ? "Execução manual em andamento"
                          : "Execução já solicitada"
                        : `${monitor.provider.toUpperCase()} · executar sem alterar a agenda`}
                    </small>
                  </span>
                  {requestingId === monitor.id || monitor.pendingExecution ? (
                    <LoaderCircle className="spinIcon" size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                </button>
              ))}
              {!enabledMonitors.length ? (
                <div className="monitoringPanelEmptySelection">
                  Nenhum monitor habilitado neste runtime.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <footer>
          <span>O executor atenderá a solicitação no próximo polling.</span>
          <div>
            <button
              className="secondaryButton"
              disabled={Boolean(requestingId)}
              onClick={onClose}
              type="button"
            >
              Fechar
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
