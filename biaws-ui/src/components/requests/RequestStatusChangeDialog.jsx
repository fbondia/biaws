import { Save, X } from "lucide-react";

import { MarkdownEditor } from "../shared/MarkdownEditor/index.jsx";

export function RequestStatusChangeDialog({
  canAddNote,
  draft,
  onChange,
  onClose,
  onSave,
  saving,
  subjectLabel,
  title,
}) {
  if (!draft) return null;

  return (
    <div
      className="dialogBackdrop requestStatusChangeDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="requestStatusChangeDialogTitle"
        aria-modal="true"
        className="requestStatusChangeDialog"
        role="dialog"
      >
        <header className="requestStatusChangeDialogHeader">
          <div>
            <span>{subjectLabel}</span>
            <h3 id="requestStatusChangeDialogTitle">Alterar status</h3>
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

        <div className="requestStatusChangeDialogBody">
          <strong>{title}</strong>
          {canAddNote ? (
            <label className="field">
              <span>Observação (opcional)</span>
              <MarkdownEditor
                onChange={(content) => onChange({ ...draft, content })}
                value={draft.content}
              />
            </label>
          ) : null}
        </div>

        <footer className="requestStatusChangeDialogFooter">
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
            disabled={saving}
            onClick={onSave}
            type="button"
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Confirmar alteração"}
          </button>
        </footer>
      </section>
    </div>
  );
}
