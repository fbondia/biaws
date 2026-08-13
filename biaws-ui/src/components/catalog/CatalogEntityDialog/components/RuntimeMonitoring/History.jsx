import { Plus, X } from "lucide-react";
import React from "react";

import { MonitoringEventDetails } from "../../../../shared/MonitoringEventDetails/index.jsx";
import { RUNTIME_STATUSES } from "../../constants.js";
import { monitoringOriginLabel } from "../../runtimeMonitoringModel.js";
import { HistoryItems, SelectField, TextField } from "../Fields.jsx";
import { Feedback, formatDate, useNestedDialogKeyboard } from "./support.jsx";

function ObservationDialog({
  draft,
  entity,
  onChange,
  onClose,
  onSave,
  saving,
}) {
  const update = (name, value) =>
    onChange((current) => ({ ...current, [name]: value }));
  const dialogRef = useNestedDialogKeyboard(onClose, saving);
  return (
    <div className="dialogBackdrop catalogMonitoringNestedBackdrop">
      <section
        aria-labelledby="manual-observation-title"
        aria-modal="true"
        className="catalogMonitoringDialog catalogObservationDialog"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <span>Observação manual em</span>
            <h2 id="manual-observation-title">{entity?.name}</h2>
          </div>
          <button
            aria-label="Fechar"
            autoFocus
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="catalogMonitoringDialogBody">
          <div className="catalogObservationContext catalogWideField">
            Runtime <strong>{entity?.key}</strong>. Esta observação será
            distinguida como manual no histórico.
          </div>
          <SelectField
            label="Saúde observada"
            name="healthStatus"
            onChange={update}
            options={RUNTIME_STATUSES}
            required
            value={draft.healthStatus}
          />
          <TextField
            label="Observado em"
            name="observedAt"
            onChange={update}
            required
            type="datetime-local"
            value={draft.observedAt}
          />
          <TextField
            label="Origem descritiva"
            name="source"
            onChange={update}
            placeholder="Ex.: plantão, Grafana"
            value={draft.source}
          />
          <label className="field catalogWideField">
            <span>Mensagem</span>
            <textarea
              onChange={(event) => update("message", event.target.value)}
              rows={4}
              value={draft.message}
            />
          </label>
        </div>
        <footer>
          <button
            className="secondaryButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="primaryButton"
            disabled={saving || !draft.observedAt}
            onClick={onSave}
            type="button"
          >
            {saving ? "Registrando..." : "Confirmar observação"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function RuntimeMonitoringHistory({
  controller,
  editing,
  entity,
  options,
}) {
  const {
    addingObservation,
    monitoringError,
    monitoringEvents,
    monitoringHistoryHasMore,
    monitoringHistoryLoadingMore,
    monitoringLoading,
    monitoringNotice,
    observationDraft,
    openObservation,
    loadMoreMonitoringEvents,
    setObservationDraft,
  } = controller;
  return (
    <div className="catalogHistorySection catalogWideField">
      <Feedback error={monitoringError} notice={monitoringNotice} />
      <div className="catalogMonitoringSectionHeader">
        <div>
          <h3>Histórico unificado</h3>
          <span>
            Observações ativas, passivas e manuais com detalhes sanitizados.
          </span>
        </div>
        {options.canUpdateRuntime && editing ? (
          <button
            className="primaryButton"
            onClick={openObservation}
            type="button"
          >
            <Plus size={16} /> Observação manual
          </button>
        ) : null}
      </div>
      {monitoringLoading && !monitoringEvents.length ? (
        <div className="catalogHistoryEmpty" role="status">
          Carregando histórico…
        </div>
      ) : (
        <HistoryItems
          empty="Nenhuma observação de monitoramento registrada."
          items={monitoringEvents}
          renderItem={(event) => (
            <>
              <div className="catalogMonitoringEventHeading monitoringEventHeading">
                <strong>{event.status}</strong>
                <span
                  className={`monitoringOriginBadge monitoringOriginBadge-${event.origin || "passive"}`}
                >
                  {monitoringOriginLabel(event.origin)}
                </span>
              </div>
              <small>
                {formatDate(event.observedAt)}
                {event.source ? ` · ${event.source}` : ""}
                {event.provider ? ` · ${event.provider}` : ""}
                {event.monitorName ? ` · ${event.monitorName}` : ""}
              </small>
              {event.templateRef ? (
                <small>
                  Template {event.templateRef.id} · {event.templateRef.version}
                </small>
              ) : null}
              {event.message ? <p>{event.message}</p> : null}
              <MonitoringEventDetails event={event} />
            </>
          )}
        />
      )}
      {monitoringHistoryHasMore ? (
        <button
          className="secondaryButton catalogMonitoringLoadMore"
          disabled={monitoringHistoryLoadingMore}
          onClick={loadMoreMonitoringEvents}
          type="button"
        >
          {monitoringHistoryLoadingMore ? "Carregando…" : "Carregar mais"}
        </button>
      ) : null}
      {observationDraft ? (
        <ObservationDialog
          draft={observationDraft}
          entity={entity}
          onChange={setObservationDraft}
          onClose={controller.closeObservation}
          onSave={controller.addObservation}
          saving={addingObservation}
        />
      ) : null}
    </div>
  );
}
