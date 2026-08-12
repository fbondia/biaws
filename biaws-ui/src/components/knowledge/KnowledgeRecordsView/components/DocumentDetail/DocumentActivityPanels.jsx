import {
  MarkdownEditor,
  MarkdownPreview,
} from "../../../../shared/MarkdownEditor/index.jsx";
import { todayIso } from "../../../knowledgeModel.js";

export function DocumentObservations({
  canUpdate,
  observationDraft,
  observations,
  onAdd,
  onDraftChange,
}) {
  return (
    <div className="dialogForm knowledgeRecordPanel">
      {canUpdate ? (
        <>
          <div className="field">
            <span>Nova observação</span>
            <MarkdownEditor onChange={onDraftChange} value={observationDraft} />
          </div>
          <button
            className="primaryButton"
            disabled={!observationDraft.trim()}
            onClick={() => void onAdd()}
            type="button"
          >
            Adicionar observação
          </button>
        </>
      ) : null}
      {observations.map((observation) => (
        <article className="auditEventContent" key={observation.id}>
          <small>
            {new Date(observation.createdAt).toLocaleString("pt-BR")} ·{" "}
            {observation.createdBy}
          </small>
          <MarkdownPreview value={observation.markdown} />
        </article>
      ))}
    </div>
  );
}

export function DocumentRevisions({ canUpdate, draft, onSave, revisions }) {
  return (
    <div className="dialogForm knowledgeRecordPanel">
      {draft.id && canUpdate ? (
        <button
          className="primaryButton"
          onClick={() =>
            onSave({
              ...draft,
              lastReviewedAt: todayIso(),
              changeSummary: "Conteúdo revisado",
            })
          }
          type="button"
        >
          Marcar como revisado hoje
        </button>
      ) : null}
      {revisions.map((revision) => (
        <article className="auditEventContent" key={revision.id}>
          <strong>Revisão {revision.revision}</strong>
          <small>
            {new Date(revision.createdAt).toLocaleString("pt-BR")} ·{" "}
            {revision.createdBy}
          </small>
          <p>{revision.summary}</p>
        </article>
      ))}
    </div>
  );
}
