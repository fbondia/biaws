import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchRuntimeMonitoringTimeline } from "../../../../api.js";
import { MonitoringEventDetails } from "../../../monitoring/components/MonitoringEventDetails/index.jsx";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";
import { formatMonitoringDate } from "../../widgets/widgetUtils.js";
import {
  EMPTY_MONITORING_FILTERS,
  monitoringFilterParams,
  MONITORING_STATUSES,
} from "../constants.js";

export function RuntimeMonitoringDialog({ runtime, onClose }) {
  const [signals, setSignals] = useState([]);
  const [meta, setMeta] = useState(null);
  const [draftFilters, setDraftFilters] = useState(EMPTY_MONITORING_FILTERS);
  const [filters, setFilters] = useState(EMPTY_MONITORING_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchRuntimeMonitoringTimeline(runtime.id, {
      page: 1,
      limit: 20,
      ...monitoringFilterParams(filters),
    })
      .then((payload) => {
        if (!active) return;
        setSignals(payload.items || []);
        setMeta(payload.meta || null);
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
  }, [runtime.id, filters]);

  function applyFilters(event) {
    event.preventDefault();
    if (
      draftFilters.observedFrom &&
      draftFilters.observedTo &&
      draftFilters.observedFrom > draftFilters.observedTo
    ) {
      setError(
        "O horário final deve ser igual ou posterior ao horário inicial.",
      );
      return;
    }
    setFilters({ ...draftFilters });
  }

  function clearFilters() {
    setDraftFilters({ ...EMPTY_MONITORING_FILTERS });
    setFilters({ ...EMPTY_MONITORING_FILTERS });
  }

  return (
    <div
      className="dialogBackdrop homeMonitoringBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="home-monitoring-dialog-title"
        aria-modal="true"
        className="homeMonitoringDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Histórico de monitoramento</span>
            <h2 id="home-monitoring-dialog-title">{runtime.name}</h2>
            <small>
              {runtime.server?.name || "Sem servidor associado"} · UUID{" "}
              {runtime.id}
            </small>
          </div>
          <button
            aria-label="Fechar histórico"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="homeMonitoringDialogBody">
          <MonitoringFilters
            applyFilters={applyFilters}
            clearFilters={clearFilters}
            draftFilters={draftFilters}
            loading={loading}
            setDraftFilters={setDraftFilters}
          />
          <MonitoringSignals
            error={error}
            loading={loading}
            signals={signals}
          />
        </div>
        {meta?.total ? (
          <footer>
            Exibindo {signals.length} de {meta.total} eventos, do mais recente
            para o mais antigo.
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function MonitoringFilters({
  applyFilters,
  clearFilters,
  draftFilters,
  loading,
  setDraftFilters,
}) {
  function update(field, value) {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="homeMonitoringFilters" onSubmit={applyFilters}>
      <label className="field">
        <span>Início</span>
        <input
          max={draftFilters.observedTo || undefined}
          onChange={(event) => update("observedFrom", event.target.value)}
          type="datetime-local"
          value={draftFilters.observedFrom}
        />
      </label>
      <label className="field">
        <span>Fim</span>
        <input
          min={draftFilters.observedFrom || undefined}
          onChange={(event) => update("observedTo", event.target.value)}
          type="datetime-local"
          value={draftFilters.observedTo}
        />
      </label>
      <label className="field">
        <span>Status</span>
        <select
          onChange={(event) => update("status", event.target.value)}
          value={draftFilters.status}
        >
          <option value="">Todos</option>
          {MONITORING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <div className="homeMonitoringFilterActions">
        <button
          className="secondaryButton"
          disabled={loading}
          onClick={clearFilters}
          type="button"
        >
          Limpar
        </button>
        <button className="primaryButton" disabled={loading} type="submit">
          Filtrar
        </button>
      </div>
    </form>
  );
}

function MonitoringSignals({ error, loading, signals }) {
  if (loading)
    return <div className="homeWidgetPending">Carregando sinais…</div>;
  if (error) return <div className="errorBox">{error}</div>;
  if (!signals.length) {
    return (
      <div className="homeWidgetEmpty">
        Nenhum sinal encontrado para os filtros informados.
      </div>
    );
  }

  return (
    <div className="homeMonitoringSignals">
      {signals.map((signal) => (
        <article key={signal.id}>
          <div className="homeMonitoringSignalHeading">
            <div className="homeMonitoringSignalBadges monitoringEventHeading">
              <span className={`catalogStatus catalogStatus-${signal.status}`}>
                {signal.status}
              </span>
              <span className="monitoringOriginBadge">
                {signal.origin === "manual" ? "Manual" : "Externo"}
              </span>
            </div>
            <time dateTime={signal.observedAt}>
              {formatMonitoringDate(signal.observedAt)}
            </time>
          </div>
          <strong>{signal.source}</strong>
          {signal.message ? <p>{signal.message}</p> : null}
          <small>
            Recebido em {formatMonitoringDate(signal.receivedAt)}
            {signal.signalId ? (
              <>
                {" · "}
                <EntityIdentifier
                  label="Identificador do sinal"
                  value={signal.signalId}
                />
              </>
            ) : null}
          </small>
          <MonitoringEventDetails event={signal} />
        </article>
      ))}
    </div>
  );
}
