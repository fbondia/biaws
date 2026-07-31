import { Clock3, RefreshCw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchAuditHistory } from "../../api.js";

const ACTION_LABELS = {
  created: "Criou",
  updated: "Alterou",
  deleted: "Excluiu",
  reordered: "Reordenou",
  status_changed: "Alterou o status",
  comment_added: "Adicionou comentário",
  comment_updated: "Alterou comentário",
  note_added: "Adicionou anotação",
  note_updated: "Alterou anotação",
  note_deleted: "Excluiu anotação",
  task_created: "Criou tarefa",
  task_updated: "Alterou tarefa",
  task_deleted: "Excluiu tarefa",
  task_status_changed: "Alterou o status da tarefa",
  task_note_added: "Adicionou anotação à tarefa",
  task_note_updated: "Alterou anotação da tarefa",
  task_note_deleted: "Excluiu anotação da tarefa",
  attachment_added: "Adicionou arquivo",
  attachment_deleted: "Excluiu arquivo",
  attachment_tags_updated: "Alterou tags do arquivo",
  imported: "Importou",
  published: "Publicou",
  deprecated: "Descontinuou",
};

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function formatDateTime(value) {
  if (!value) return "Data não informada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsed);
}

export function AuditHistory({ entityType, entityId, refreshKey }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchAuditHistory(entityType, entityId)
      .then((payload) => {
        if (active) setEvents(payload.events || []);
      })
      .catch((requestError) => {
        if (active)
          setError(
            requestError.message || "Não foi possível carregar o histórico.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entityType, entityId, refreshKey, reloadKey]);

  if (loading)
    return <div className="loadingLine">Carregando histórico...</div>;

  return (
    <section className="auditHistory" aria-label="Histórico de alterações">
      <header className="auditHistoryHeader">
        <div>
          <h3>Histórico de alterações</h3>
          <span>
            {events.length} {events.length === 1 ? "evento" : "eventos"}
          </span>
        </div>
        <button
          className="iconButton"
          onClick={() => setReloadKey((value) => value + 1)}
          title="Atualizar histórico"
          type="button"
        >
          <RefreshCw size={16} />
        </button>
      </header>
      {error ? <div className="errorBox">{error}</div> : null}
      {!error && !events.length ? (
        <div className="emptyState compactEmpty">
          Nenhuma alteração registrada.
        </div>
      ) : null}
      <div className="auditTimeline">
        {events.map((event) => {
          const actor =
            event.actor?.displayName ||
            event.actor?.email ||
            event.actor?.userId ||
            "Usuário não identificado";
          return (
            <article className="auditEvent" key={event.id}>
              <div className="auditEventMarker" />
              <div className="auditEventContent">
                <header>
                  <strong>
                    {event.summary ||
                      ACTION_LABELS[event.action] ||
                      event.action}
                  </strong>
                  <span>
                    <Clock3 size={13} /> {formatDateTime(event.occurredAt)}
                  </span>
                </header>
                <div className="auditActor">
                  <UserRound size={14} />
                  <span>{actor}</span>
                  {event.actor?.email && event.actor.email !== actor ? (
                    <small>{event.actor.email}</small>
                  ) : null}
                </div>
                {event.target?.label ? (
                  <div className="auditTarget">{event.target.label}</div>
                ) : null}
                {event.changes?.length ? (
                  <div className="auditChanges">
                    {event.changes.map((change, index) => (
                      <div
                        className="auditChange"
                        key={`${event.id}-${change.field}-${index}`}
                      >
                        <code>{change.field}</code>
                        <div>
                          <pre>{formatValue(change.before)}</pre>
                          <span aria-hidden="true">→</span>
                          <pre>{formatValue(change.after)}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
