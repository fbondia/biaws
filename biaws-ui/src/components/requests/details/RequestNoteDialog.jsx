import { Save, X } from "lucide-react";

import { MarkdownEditor } from "../../shared/MarkdownEditor/index.jsx";

export function RequestNoteDialog({
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
      className="dialogBackdrop requestNoteDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="requestNoteDialogTitle"
        aria-modal="true"
        className="requestNoteDialog"
        role="dialog"
      >
        <header className="requestNoteDialogHeader">
          <div>
            <span>Anotação da melhoria</span>
            <h3 id="requestNoteDialogTitle">
              {mode === "edit" ? "Editar anotação" : "Incluir anotação"}
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

        <div className="requestNoteDialogBody">
          <label className="field requestNoteDateField">
            <span>Data</span>
            <input
              autoFocus
              disabled={saving}
              onChange={(event) =>
                onChange({ ...draft, date: event.target.value })
              }
              type="date"
              value={draft.date}
            />
          </label>
          <label className="field requestNoteContentField">
            <span>Anotação</span>
            <MarkdownEditor
              onChange={(content) => onChange({ ...draft, content })}
              value={draft.content}
            />
          </label>
        </div>

        <footer className="requestNoteDialogFooter">
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
            disabled={saving || !draft.content.trim()}
            onClick={onSave}
            type="button"
          >
            <Save size={16} />
            Salvar anotação
          </button>
        </footer>
      </section>
    </div>
  );
}
