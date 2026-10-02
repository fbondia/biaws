import { Save, X } from "lucide-react";

export function IssueIdentityDialog({ canSave, draft, error, identifierError, onChange, onClose, onSave, saving }) {
  return (
    <div
      className="dialogBackdrop issueIdentityDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <form
        aria-labelledby="issueIdentityDialogTitle"
        aria-modal="true"
        className="issueDescriptionDialog issueIdentityDialog"
        onSubmit={onSave}
        role="dialog"
      >
        <header className="issueDescriptionDialogHeader">
          <div>
            <span>Dados da issue</span>
            <h3 id="issueIdentityDialogTitle">Editar identificador e título</h3>
          </div>
          <button
            aria-label="Fechar edição"
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="issueDescriptionDialogBody">
          {error ? (
            <div className="errorBox" role="alert">
              {error}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="issueIdentityIdentifier">
              <span>Identificador (opcional)</span>
            </label>
            <input
              aria-describedby="issueIdentityIdentifierHint"
              aria-invalid={Boolean(identifierError)}
              autoFocus
              data-dialog-initial-focus
              disabled={saving}
              id="issueIdentityIdentifier"
              maxLength={100}
              name="identifier"
              onChange={(event) => onChange({ ...draft, identifier: event.target.value })}
              placeholder="Ex.: INC12345"
              value={draft.identifier}
            />
            <small id="issueIdentityIdentifierHint" role={identifierError ? "alert" : undefined}>
              {identifierError || "Deixe em branco para remover o identificador."}
            </small>
          </div>
          <label className="field">
            <span>Título</span>
            <input
              disabled={saving}
              name="title"
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              required
              value={draft.title}
            />
          </label>
        </div>
        <footer className="issueDescriptionDialogFooter">
          <button className="secondaryButton" disabled={saving} onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primaryButton" disabled={!canSave} type="submit">
            <Save aria-hidden="true" size={16} />
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </footer>
      </form>
    </div>
  );
}
