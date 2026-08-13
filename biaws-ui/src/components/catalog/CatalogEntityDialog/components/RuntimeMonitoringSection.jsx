import { MonitoringEventDetails } from "../../../shared/MonitoringEventDetails/index.jsx";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";
import { RUNTIME_STATUSES } from "../constants.js";
import { HistoryItems, SelectField, TextField } from "./Fields.jsx";

function formatDate(value) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function RuntimeMonitoringSummary({ monitoring }) {
  return (
    <div className="catalogMonitoringSummary">
      <strong>Linha do tempo de monitoramento</strong>
      <span>
        Sinais externos e observações manuais aparecem juntos, com a origem
        identificada em cada registro.
      </span>
      {monitoring ? (
        <small>
          Último sinal externo: {monitoring.status} ·{" "}
          {formatDate(monitoring.observedAt)} · {monitoring.source}
        </small>
      ) : (
        <small>Nenhum sinal externo recebido.</small>
      )}
    </div>
  );
}

export function RuntimeMonitoringSection({
  addObservation,
  addingObservation,
  curlExample,
  draft,
  editing,
  entity,
  monitoringError,
  monitoringEvents,
  observationDraft,
  options,
  runtimePath,
  setObservationDraft,
  update,
}) {
  return (
    <div className="catalogHistorySection catalogWideField">
      <RuntimeMonitoringSummary monitoring={entity?.monitoring} />
      <div className="catalogMonitoringInstructions">
        <h3>Referência do runtime</h3>
        <p>
          Envie sinais usando o UUID ou o caminho formado pelos identificadores
          da aplicação, componente, deployment e runtime. O UUID não muda; o
          caminho acompanha edições nos identificadores.
        </p>
        <dl>
          <div>
            <dt>Workspace</dt>
            <dd>
              <EntityIdentifier
                label="Identificador do workspace"
                value={options.workspace?.id}
              />
            </dd>
          </div>
          <div>
            <dt>UUID</dt>
            <dd>
              <EntityIdentifier
                fallback="UUID indisponível"
                label="UUID do runtime"
                value={entity?.id}
              />
            </dd>
          </div>
          <div>
            <dt>Caminho</dt>
            <dd>
              <code>{runtimePath || "Caminho indisponível"}</code>
            </dd>
          </div>
        </dl>
        {curlExample ? (
          <>
            <h3>Exemplo com curl</h3>
            <pre>
              <code>{curlExample}</code>
            </pre>
          </>
        ) : null}
      </div>
      {monitoringError ? (
        <div className="errorBox">{monitoringError}</div>
      ) : null}
      <label className="field catalogMonitoringRetention">
        <span>Retenção do histórico (dias)</span>
        <input
          max="3650"
          min="0"
          onChange={(event) =>
            update("monitoringRetentionDays", event.target.value)
          }
          type="number"
          value={draft.monitoringRetentionDays}
        />
        <small>
          Padrão: 10 dias. Use 0 para manter o histórico sem expiração.
        </small>
      </label>
      <h3 className="catalogMonitoringManualTitle">
        Adicionar observação manual
      </h3>
      <div className="catalogHistoryComposer">
        <SelectField
          label="Saúde observada"
          name="observationStatus"
          onChange={(_name, value) =>
            setObservationDraft((current) => ({
              ...current,
              healthStatus: value,
            }))
          }
          options={RUNTIME_STATUSES}
          value={observationDraft.healthStatus}
        />
        <TextField
          label="Observado em"
          name="observationDate"
          onChange={(_name, value) =>
            setObservationDraft((current) => ({
              ...current,
              observedAt: value,
            }))
          }
          type="datetime-local"
          value={observationDraft.observedAt}
        />
        <TextField
          label="Origem"
          name="observationSource"
          onChange={(_name, value) =>
            setObservationDraft((current) => ({
              ...current,
              source: value,
            }))
          }
          placeholder="Ex.: Zabbix, Grafana, registro manual"
          value={observationDraft.source}
        />
        <label className="field catalogHistoryDescription">
          <span>Mensagem</span>
          <textarea
            onChange={(event) =>
              setObservationDraft((current) => ({
                ...current,
                message: event.target.value,
              }))
            }
            rows={3}
            value={observationDraft.message}
          />
        </label>
        <button
          className="secondaryButton"
          disabled={
            !editing || !observationDraft.observedAt || addingObservation
          }
          onClick={addObservation}
          type="button"
        >
          {addingObservation ? "Registrando..." : "Adicionar observação"}
        </button>
      </div>
      {!editing ? (
        <small>Salve o runtime antes de registrar observações.</small>
      ) : null}
      <HistoryItems
        empty="Nenhum registro de monitoramento recebido."
        items={monitoringEvents}
        renderItem={(event) => (
          <>
            <div className="catalogMonitoringEventHeading monitoringEventHeading">
              <strong>{event.status}</strong>
              <span className="monitoringOriginBadge">
                {event.origin === "manual" ? "Manual" : "Externo"}
              </span>
            </div>
            <small>
              {formatDate(event.observedAt)}
              {event.source ? ` · ${event.source}` : ""}
            </small>
            {event.message ? <p>{event.message}</p> : null}
            <MonitoringEventDetails event={event} />
          </>
        )}
      />
    </div>
  );
}
