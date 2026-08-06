import { X } from "lucide-react";
import { useState } from "react";

import { createSecret, createSecretFile } from "../../../../api.js";
import {
  EMPTY_SECRET_FORM,
  permissionApplicationIds,
  suggestSecretIdentifier,
} from "../model.js";
import {
  SecretScopeField,
  SecretTypeEnvironmentFields,
} from "./SecretFormFields.jsx";

export function CreateSecretDialog({
  actor,
  applications,
  onClose,
  onCreated,
}) {
  const [form, setForm] = useState(EMPTY_SECRET_FORM);
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const createScope = actor.permissionScopes?.["secrets.create"] || {};
  const writeScope = actor.permissionScopes?.["secrets.value.write"] || {};
  const canCreateWorkspaceSecret =
    createScope.workspace && writeScope.workspace;
  const allowedApplicationIds = canCreateWorkspaceSecret
    ? applications.map(({ id }) => id)
    : permissionApplicationIds(
        actor,
        "secrets.create",
        "secrets.value.write",
      ).filter(
        (id) =>
          (createScope.workspace || createScope.applicationIds?.includes(id)) &&
          (writeScope.workspace || writeScope.applicationIds?.includes(id)),
      );

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const metadata = {
        name: form.name,
        identifier: form.identifier,
        description: form.description,
        type: form.type,
        environment: form.environment,
        applicationId: form.applicationId || null,
      };
      const payload =
        form.contentKind === "file"
          ? await createSecretFile(metadata, form.file)
          : await createSecret({ ...metadata, value: form.value });
      setForm(EMPTY_SECRET_FORM);
      onCreated(payload.secret);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialogBackdrop" role="presentation">
      <section
        aria-labelledby="create-secret-title"
        aria-modal="true"
        className="userCreateDialog secretCreateDialog"
        role="dialog"
      >
        <header className="userCreateDialogHeader">
          <div>
            <span>Cofre local</span>
            <h2 id="create-secret-title">Novo segredo</h2>
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
              onChange={(event) => {
                const name = event.target.value;
                setForm({
                  ...form,
                  name,
                  identifier: identifierTouched
                    ? form.identifier
                    : suggestSecretIdentifier(name),
                });
              }}
              required
              value={form.name}
            />
          </label>
          <label>
            Identificação
            <input
              autoCapitalize="none"
              autoComplete="off"
              maxLength="100"
              minLength="2"
              onChange={(event) => {
                setIdentifierTouched(true);
                setForm({ ...form, identifier: event.target.value });
              }}
              pattern="[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])"
              placeholder="ex.: github-token-producao"
              required
              spellCheck="false"
              value={form.identifier}
            />
            <small>
              Chave técnica única no workspace. Não poderá ser alterada.
            </small>
          </label>
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
            workspaceAllowed={canCreateWorkspaceSecret}
          />
          <label>
            Formato do conteúdo
            <select
              onChange={(event) =>
                setForm({
                  ...form,
                  contentKind: event.target.value,
                  value: "",
                  file: null,
                })
              }
              value={form.contentKind}
            >
              <option value="text">Texto</option>
              <option value="file">Arquivo</option>
            </select>
          </label>
          {form.contentKind === "file" ? (
            <label>
              Arquivo
              <input
                onChange={(event) =>
                  setForm({ ...form, file: event.target.files?.[0] || null })
                }
                required
                type="file"
              />
              <small>
                Até 5 MiB. Chaves, certificados e arquivos .env são aceitos.
              </small>
            </label>
          ) : (
            <label>
              Valor
              <textarea
                autoComplete="off"
                onChange={(event) =>
                  setForm({ ...form, value: event.target.value })
                }
                required
                rows="5"
                value={form.value}
              />
              <small>O valor será criptografado antes de ser persistido.</small>
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
              Criar segredo
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
