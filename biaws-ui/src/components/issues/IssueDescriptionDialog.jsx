import { Save, X } from "lucide-react";

import { MarkdownEditor } from "../shared/MarkdownEditor/index.jsx";

export function IssueDescriptionDialog({
  draft,
  error,
  onChange,
  onClose,
  onSave,
  open,
  saving,
}) {
  if (!open) return null;

  return (
    <div
      className="dialogBackdrop issueDescriptionDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="issueDescriptionDialogTitle"
        aria-modal="true"
        className="issueDescriptionDialog"
        role="dialog"
      >
        <header className="issueDescriptionDialogHeader">
          <div>
            <span>Dados da issue</span>
            <h3 id="issueDescriptionDialogTitle">Editar descrição</h3>
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
        <div className="issueDescriptionDialogBody">
          {error ? <div className="errorBox">{error}</div> : null}
          <label className="field">
            <span>Título</span>
            <input
              autoFocus
              disabled={saving}
              onChange={(event) =>
                onChange({ ...draft, title: event.target.value })
              }
              value={draft.title}
            />
          </label>
          <label className="field issueDescriptionContentField">
            <span>Descrição</span>
            <MarkdownEditor
              onChange={(text) => onChange({ ...draft, text })}
              value={draft.text}
            />
          </label>
        </div>
        <footer className="issueDescriptionDialogFooter">
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
            disabled={saving || !draft.title.trim() || !draft.text.trim()}
            onClick={onSave}
            type="button"
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar descrição"}
          </button>
        </footer>
      </section>
    </div>
  );
}
