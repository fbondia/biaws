function hasProperties(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (Array.isArray(value) || Object.keys(value).length),
  );
}

function JsonBlock({ label, showEmpty = false, value }) {
  if (!showEmpty && !hasProperties(value)) return null;
  if (value === undefined || value === null) return null;
  return (
    <div className="monitoringEventJson">
      <strong>{label}</strong>
      <pre>
        <code>{JSON.stringify(value, null, 2)}</code>
      </pre>
    </div>
  );
}

export function MonitoringEventDetails({ event }) {
  return (
    <details className="monitoringEventDetails">
      <summary>Ver detalhes</summary>
      <dl>
        <div>
          <dt>Origem do registro</dt>
          <dd>{event.origin === "manual" ? "Manual" : "Externa"}</dd>
        </div>
        {event.signalId ? (
          <div>
            <dt>ID do sinal</dt>
            <dd>
              <code>{event.signalId}</code>
            </dd>
          </div>
        ) : null}
        {event.recordedBy ? (
          <div>
            <dt>Registrado por</dt>
            <dd>{event.recordedBy}</dd>
          </div>
        ) : null}
        {event.receivedAt ? (
          <div>
            <dt>Recebido em</dt>
            <dd>{new Date(event.receivedAt).toLocaleString("pt-BR")}</dd>
          </div>
        ) : null}
      </dl>
      <JsonBlock label="Metadata" value={event.metadata} />
      <JsonBlock label="Payload" showEmpty value={event.payload} />
    </details>
  );
}
