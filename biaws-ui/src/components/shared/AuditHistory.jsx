import { Clock3, FileDiff, RefreshCw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchAuditHistory } from "../../api.js";
import { buildAuditLineDiff, formatAuditValue } from "./auditDiff.js";

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
  archived: "Arquivou",
  restored: "Desarquivou",
  reactivated: "Reativou",
};

function formatDateTime(value) {
  if (!value) return "Data não informada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsed);
}

function AuditChange({ change, changeId }) {
  const [expanded, setExpanded] = useState(false);
  const diffId = `${changeId}-diff`;

  return (
    <div className={`auditChange${expanded ? " isExpanded" : ""}`}>
      <div className="auditChangeHeader">
        <code>{change.field}</code>
        <button
          aria-controls={diffId}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Recolher" : "Expandir"} diff do campo ${change.field}`}
          className="auditDiffButton"
          onClick={() => setExpanded((value) => !value)}
          title={`${expanded ? "Recolher" : "Visualizar"} alterações`}
          type="button"
        >
          <FileDiff size={16} />
        </button>
      </div>
      {!expanded ? (
        <div className="auditChangeSummary">
          <pre className="auditChangeBefore">
            {formatAuditValue(change.before)}
          </pre>
          <span aria-hidden="true">→</span>
          <pre className="auditChangeAfter">
            {formatAuditValue(change.after)}
          </pre>
        </div>
      ) : (
        <div className="auditDiff" id={diffId}>
          <div className="auditDiffLegend" aria-hidden="true">
            <span className="auditDiffRemoved">− removido</span>
            <span className="auditDiffAdded">+ adicionado</span>
          </div>
          <div
            className="auditDiffCode"
            role="table"
            aria-label="Comparação das alterações"
          >
            {buildAuditLineDiff(change.before, change.after).map(
              (line, index) => (
                <div
                  className={`auditDiffLine auditDiffLine-${line.type}`}
                  key={`${line.type}-${line.beforeLine}-${line.afterLine}-${index}`}
                  role="row"
                >
                  <span className="auditDiffLineNumber" role="cell">
                    {line.beforeLine ?? ""}
                  </span>
                  <span className="auditDiffLineNumber" role="cell">
                    {line.afterLine ?? ""}
                  </span>
                  <span className="auditDiffMarker" aria-hidden="true">
                    {line.type === "removed"
                      ? "−"
                      : line.type === "added"
                        ? "+"
                        : " "}
                  </span>
                  <code role="cell">{line.value || " "}</code>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
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
                    {event.changes.map((change, index) => {
                      const changeId = `${event.id}-${change.field}-${index}`;
                      return (
                        <AuditChange
                          change={change}
                          changeId={changeId}
                          key={changeId}
                        />
                      );
                    })}
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
