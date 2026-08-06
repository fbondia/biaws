import { X } from "lucide-react";
import { useState } from "react";

import { updateSecretMetadata } from "../../../../api.js";
import {
  SecretScopeField,
  SecretTypeEnvironmentFields,
} from "./SecretFormFields.jsx";

export function EditSecretDialog({
  actor,
  applications,
  secret,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    name: secret.name,
    description: secret.description || "",
    type: secret.type,
    environment: secret.environment || "",
    applicationId: secret.applicationId || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const updateScope = actor.permissionScopes?.["secrets.update"] || {};
  const allowedApplicationIds = updateScope.workspace
    ? applications.map(({ id }) => id)
    : updateScope.applicationIds || [];

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = await updateSecretMetadata(secret.id, {
        ...form,
        applicationId: form.applicationId || null,
      });
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
        aria-labelledby="edit-secret-title"
        aria-modal="true"
        className="userCreateDialog secretCreateDialog"
        role="dialog"
      >
        <header className="userCreateDialogHeader">
          <div>
            <span>Metadados</span>
            <h2 id="edit-secret-title">Editar segredo</h2>
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
          <label>
            Nome
            <input
              autoFocus
              maxLength="100"
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
              value={form.name}
            />
          </label>
          <div className="secretFormGrid">
            <label>
              Identificação
              <input disabled readOnly value={secret.identifier} />
            </label>
            <label>
              Formato
              <input
                disabled
                readOnly
                value={secret.contentKind === "file" ? "Arquivo" : "Texto"}
              />
            </label>
          </div>
          <label>
            Descrição
            <textarea
              maxLength="500"
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              rows="3"
              value={form.description}
            />
          </label>
          <SecretTypeEnvironmentFields form={form} setForm={setForm} />
          <SecretScopeField
            allowedApplicationIds={allowedApplicationIds}
            applications={applications}
            form={form}
            setForm={setForm}
            workspaceAllowed={updateScope.workspace}
          />
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
              Salvar alterações
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
