import { X, Plus } from "lucide-react";
import { useState } from "react";

import { createPlatformWorkspace } from "../../../../api.js";

const EMPTY_FORM = {
  key: "",
  name: "",
  description: "",
  administratorUserId: "",
};

export function WorkspaceFormDialog({ actor, onClose, onCreated, users }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    administratorUserId: actor.userId,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await createPlatformWorkspace(form);
      onCreated(result.workspace);
    } catch (creationError) {
      setError(creationError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialogBackdrop" role="presentation">
      <form
        aria-labelledby="workspace-create-title"
        aria-modal="true"
        className="platformDialog"
        onSubmit={submit}
        role="dialog"
      >
        <header className="platformDialogHeader">
          <div className="platformDialogTitleBlock">
            <span className="platformDialogKicker">Administração global</span>
            <h2 id="workspace-create-title">Novo workspace</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="platformDialogBody">
          <label>
            <span>Nome</span>
            <input
              maxLength={160}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
              value={form.name}
            />
          </label>
          <label>
            <span>Chave</span>
            <input
              maxLength={80}
              onChange={(event) =>
                setForm({ ...form, key: event.target.value.toLowerCase() })
              }
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="exemplo-workspace"
              required
              value={form.key}
            />
          </label>
          <label>
            <span>Descrição</span>
            <textarea
              maxLength={1000}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              rows={3}
              value={form.description}
            />
          </label>
          <label>
            <span>Administrador inicial</span>
            <select
              onChange={(event) =>
                setForm({ ...form, administratorUserId: event.target.value })
              }
              required
              value={form.administratorUserId}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email} · {user.email}
                </option>
              ))}
            </select>
          </label>
          {error ? <div className="authError">{error}</div> : null}
        </div>
        <footer className="platformDialogActions">
          <button className="secondaryButton" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="primaryButton" disabled={saving} type="submit">
            <Plus size={16} /> {saving ? "Criando…" : "Criar workspace"}
          </button>
        </footer>
      </form>
    </div>
  );
}
