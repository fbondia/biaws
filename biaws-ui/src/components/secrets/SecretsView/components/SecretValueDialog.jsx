import { X } from "lucide-react";
import { useState } from "react";

import { writeSecretFile, writeSecretValue } from "../../../../api.js";

export function SecretValueDialog({ secret, onClose, onSaved }) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isPending = secret.provisioningStatus === "pending";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload =
        secret.contentKind === "file"
          ? await writeSecretFile(secret.id, file)
          : await writeSecretValue(secret.id, value);
      setValue("");
      setFile(null);
      onSaved(payload.secret);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialogBackdrop" role="presentation">
      <section
        aria-labelledby="secret-value-title"
        aria-modal="true"
        className="userCreateDialog changePasswordDialog"
        role="dialog"
      >
        <header className="userCreateDialogHeader">
          <div>
            <span>{isPending ? "Provisionar segredo" : "Nova versão"}</span>
            <h2 id="secret-value-title">{secret.name}</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <form className="userCreateDialogForm" onSubmit={submit}>
          {error ? <div className="authError">{error}</div> : null}
          {secret.contentKind === "file" ? (
            <label>
              {isPending ? "Arquivo" : "Novo arquivo"}
              <input
                autoFocus
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
                type="file"
              />
              <small>
                {isPending
                  ? "O conteúdo será criptografado e registrado como versão 1."
                  : "O arquivo substituirá apenas a versão corrente."}
              </small>
            </label>
          ) : (
            <label>
              {isPending ? "Valor" : "Novo valor"}
              <textarea
                autoComplete="off"
                autoFocus
                onChange={(event) => setValue(event.target.value)}
                required
                rows="5"
                value={value}
              />
            </label>
          )}
          <footer className="userCreateDialogFooter secretDialogFooter">
            <button
              className="secondaryButton"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button className="primaryButton" disabled={saving} type="submit">
              {isPending ? "Provisionar segredo" : "Gravar versão"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
