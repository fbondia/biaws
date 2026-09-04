import { Save, X } from "lucide-react";

import { MarkdownEditor } from "../../shared/MarkdownEditor/index.jsx";

export function RequestTaskNoteDialog({
  draft,
  mode,
  onChange,
  onClose,
  onSave,
  saving,
}) {
  if (!mode) return null;

  const isEditing = mode === "edit";

  return (
    <div
      className="dialogBackdrop requestTaskNoteDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="requestTaskNoteDialogTitle"
        aria-modal="true"
        className="requestTaskNoteDialog"
        role="dialog"
      >
        <header className="requestTaskNoteDialogHeader">
          <div>
            <span>Nota de execução</span>
            <h3 id="requestTaskNoteDialogTitle">
              {isEditing ? "Editar nota" : "Incluir nota"}
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

        <div className="requestTaskNoteDialogBody">
          <label className="field requestTaskNoteDateField">
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
          <label className="field requestTaskNoteContentField">
            <span>Nota</span>
            <MarkdownEditor
              initialMode="text"
              onChange={(content) => onChange({ ...draft, content })}
              value={draft.content}
            />
          </label>
        </div>

        <footer className="requestTaskNoteDialogFooter">
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
            Salvar nota
          </button>
        </footer>
      </section>
    </div>
  );
}
