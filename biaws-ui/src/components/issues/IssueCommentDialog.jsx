import { Save, X } from "lucide-react";

import { MarkdownEditor } from "../shared/MarkdownEditor/index.jsx";

export function IssueCommentDialog({
  draft,
  mode,
  onChange,
  onClose,
  onSave,
  saving,
}) {
  if (!mode) return null;

  return (
    <div
      className="dialogBackdrop issueCommentDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="issueCommentDialogTitle"
        aria-modal="true"
        className="issueCommentDialog"
        role="dialog"
      >
        <header className="issueCommentDialogHeader">
          <div>
            <span>Comentário da issue</span>
            <h3 id="issueCommentDialogTitle">
              {mode === "edit" ? "Editar comentário" : "Incluir comentário"}
            </h3>
          </div>
          <button
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="issueCommentDialogBody">
          <label className="field issueCommentDateField">
            <span>Data</span>
            <input
              disabled={saving}
              onChange={(event) =>
                onChange({ ...draft, date: event.target.value })
              }
              type="date"
              value={draft.date}
            />
          </label>
          <label className="field issueCommentContentField">
            <span>Comentário</span>
            <MarkdownEditor
              onChange={(text) => onChange({ ...draft, text })}
              value={draft.text}
            />
          </label>
        </div>
        <footer className="issueCommentDialogFooter">
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
            disabled={saving || !draft.text.trim() || !draft.date}
            onClick={onSave}
            type="button"
          >
            <Save size={16} />
            Salvar comentário
          </button>
        </footer>
      </section>
    </div>
  );
}
