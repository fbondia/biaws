import { FolderPlus, Pencil, X } from "lucide-react";
import { useState } from "react";

export function ResourceCollectionDialog({
  collection,
  parentLabel,
  onClose,
  onSave,
  resourceLabel = "procedimentos",
}) {
  const editing = Boolean(collection);
  const [name, setName] = useState(collection?.name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(name);
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-labelledby="procedureCollectionDialogTitle"
        aria-modal="true"
        className="procedureCollectionDialog"
        role="dialog"
      >
        <header className="procedureCollectionDialogHeader">
          <div>
            <span>Organização de {resourceLabel}</span>
            <h2 id="procedureCollectionDialogTitle">
              {editing ? "Renomear coleção" : "Nova coleção"}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <form className="procedureCollectionDialogForm" onSubmit={submit}>
          {error ? <div className="errorBox">{error}</div> : null}
          {editing ? (
            <p>Altere o nome usado para identificar esta coleção.</p>
          ) : (
            <p>
              A coleção será criada em <strong>{parentLabel}</strong>.
            </p>
          )}
          <label className="field">
            <span>Nome da coleção</span>
            <input
              autoFocus
              disabled={saving}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Banco de dados"
              required
              value={name}
            />
          </label>
          <footer className="procedureCollectionDialogFooter">
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
              disabled={saving || !name.trim()}
              type="submit"
            >
              {editing ? <Pencil size={16} /> : <FolderPlus size={16} />}
              {saving
                ? editing
                  ? "Salvando..."
                  : "Criando..."
                : editing
                  ? "Salvar nome"
                  : "Criar coleção"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
