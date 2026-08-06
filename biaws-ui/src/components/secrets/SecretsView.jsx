import {
  Archive,
  Copy,
  Download,
  Eye,
  EyeOff,
  File,
  KeyRound,
  Plus,
  RotateCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  archiveSecret,
  createSecret,
  createSecretFile,
  downloadSecretFile,
  fetchApplications,
  fetchSecrets,
  revealSecretValue,
  writeSecretFile,
  writeSecretValue,
} from "../../api.js";
import { hasEveryPermission, hasPermission } from "../../permissions.js";

const EMPTY_FORM = {
  name: "",
  description: "",
  type: "generic",
  environment: "",
  applicationId: "",
  contentKind: "text",
  value: "",
  file: null,
};

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function permissionApplicationIds(actor, ...permissions) {
  return [
    ...new Set(
      permissions.flatMap(
        (permission) =>
          actor.permissionScopes?.[permission]?.applicationIds || [],
      ),
    ),
  ];
}

function SecretValueDialog({ secret, onClose, onSaved }) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
            <span>Nova versão</span>
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
              Novo arquivo
              <input
                autoFocus
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
                type="file"
              />
              <small>O arquivo substituirá apenas a versão corrente.</small>
            </label>
          ) : (
            <label>
              Novo valor
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
              Gravar versão
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function CreateSecretDialog({ actor, applications, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
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
  const availableApplications = applications.filter(({ id }) =>
    allowedApplicationIds.includes(id),
  );

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const metadata = {
        name: form.name,
        description: form.description,
        type: form.type,
        environment: form.environment,
        applicationId: form.applicationId || null,
      };
      const payload =
        form.contentKind === "file"
          ? await createSecretFile(metadata, form.file)
          : await createSecret({ ...metadata, value: form.value });
      setForm(EMPTY_FORM);
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
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
              value={form.name}
            />
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
          <div className="secretFormGrid">
            <label>
              Tipo
              <select
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value })
                }
                value={form.type}
              >
                <option value="generic">Genérico</option>
                <option value="password">Senha externa</option>
                <option value="api-key">API key externa</option>
                <option value="token">Token</option>
                <option value="private-key">Chave privada</option>
              </select>
            </label>
            <label>
              Ambiente
              <select
                onChange={(event) =>
                  setForm({ ...form, environment: event.target.value })
                }
                value={form.environment}
              >
                <option value="">Não informado</option>
                <option value="development">Desenvolvimento</option>
                <option value="test">Teste</option>
                <option value="staging">Homologação</option>
                <option value="production">Produção</option>
                <option value="other">Outro</option>
              </select>
            </label>
          </div>
          <label>
            Escopo
            <select
              onChange={(event) =>
                setForm({ ...form, applicationId: event.target.value })
              }
              required={!canCreateWorkspaceSecret}
              value={form.applicationId}
            >
              {canCreateWorkspaceSecret ? (
                <option value="">Workspace inteiro</option>
              ) : (
                <option value="">Selecione uma aplicação</option>
              )}
              {availableApplications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.name}
                </option>
              ))}
              {allowedApplicationIds
                .filter(
                  (id) =>
                    !availableApplications.some(
                      (application) => application.id === id,
                    ),
                )
                .map((id) => (
                  <option key={id} value={id}>
                    Aplicação {id}
                  </option>
                ))}
            </select>
          </label>
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

export function SecretsView({ actor }) {
  const [secrets, setSecrets] = useState([]);
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [versioning, setVersioning] = useState(null);
  const [revealed, setRevealed] = useState(null);
  const [showValue, setShowValue] = useState(false);
  const canCreate = hasEveryPermission(
    actor,
    "secrets.create",
    "secrets.value.write",
  );
  const canWrite = hasPermission(actor, "secrets.value.write");
  const canReveal = hasPermission(actor, "secrets.value.reveal");
  const canArchive = hasPermission(actor, "secrets.archive");
  const applicationNames = useMemo(
    () => Object.fromEntries(applications.map(({ id, name }) => [id, name])),
    [applications],
  );

  function canActOnSecret(permission, secret) {
    const scope = actor.permissionScopes?.[permission];
    return Boolean(
      scope?.workspace ||
      (secret.applicationId &&
        scope?.applicationIds?.includes(secret.applicationId)),
    );
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [secretsPayload, applicationsPayload] = await Promise.all([
        fetchSecrets(),
        hasPermission(actor, "applications.read")
          ? fetchApplications(actor.workspaceId, { limit: 100 })
          : Promise.resolve({ items: [] }),
      ]);
      setSecrets(secretsPayload.items || []);
      setApplications(applicationsPayload.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!revealed) return undefined;
    const timer = window.setTimeout(() => {
      setRevealed(null);
      setShowValue(false);
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  async function reveal(secret) {
    setError("");
    setRevealed(null);
    try {
      const payload = await revealSecretValue(secret.id);
      setRevealed({ ...payload, secretId: secret.id });
      setShowValue(true);
    } catch (revealError) {
      setError(revealError.message);
    }
  }

  async function download(secret) {
    setError("");
    try {
      const payload = await downloadSecretFile(secret.id);
      const url = window.URL.createObjectURL(payload.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.fileName
        ? decodeURIComponent(payload.fileName)
        : secret.file?.name || "secret-file";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  async function archive(secret) {
    if (!window.confirm(`Arquivar o segredo “${secret.name}”?`)) return;
    setError("");
    try {
      await archiveSecret(secret.id);
      setRevealed(null);
      await load();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  return (
    <section className="securityView secretsView">
      <header className="securityHeader">
        <div>
          <h2>Segredos</h2>
          <p>Credenciais externas armazenadas no cofre criptografado.</p>
        </div>
        {canCreate ? (
          <button
            className="primaryButton"
            onClick={() => setCreating(true)}
            type="button"
          >
            <Plus size={16} /> Novo segredo
          </button>
        ) : null}
      </header>
      {error ? <div className="authError">{error}</div> : null}
      {loading ? <p>Carregando segredos…</p> : null}
      {!loading && !secrets.length ? (
        <div className="securityPanel secretsEmptyState">
          <KeyRound size={28} />
          <strong>Nenhum segredo acessível</strong>
          <p>Crie o primeiro segredo para este workspace ou aplicação.</p>
        </div>
      ) : null}
      <div className="secretsGrid">
        {secrets.map((secret) => (
          <article className="securityPanel secretCard" key={secret.id}>
            <header>
              <div>
                <strong>{secret.name}</strong>
                <small>
                  {secret.environment || "Sem ambiente"} · versão{" "}
                  {secret.currentVersion}
                </small>
              </div>
              <span className="typeBadge">{secret.type}</span>
            </header>
            {secret.description ? <p>{secret.description}</p> : null}
            {secret.contentKind === "file" ? (
              <div className="secretFileMetadata">
                <File size={17} />
                <div>
                  <strong>{secret.file?.name || "Arquivo secreto"}</strong>
                  <small>
                    {formatBytes(secret.file?.size)} ·{" "}
                    {secret.file?.mediaType || "application/octet-stream"}
                  </small>
                </div>
              </div>
            ) : null}
            <small>
              {secret.applicationId
                ? applicationNames[secret.applicationId] || secret.applicationId
                : "Workspace inteiro"}
            </small>
            {revealed?.secretId === secret.id ? (
              <div className="secretNotice secretRevealedValue">
                <div>
                  <strong>Valor revelado</strong>
                  <span>Será ocultado automaticamente em 30 segundos.</span>
                </div>
                <code>{showValue ? revealed.value : "••••••••••••"}</code>
                <div className="securityActions">
                  <button
                    className="secondaryButton"
                    onClick={() => setShowValue((current) => !current)}
                    type="button"
                  >
                    {showValue ? <EyeOff size={15} /> : <Eye size={15} />}
                    {showValue ? "Ocultar" : "Mostrar"}
                  </button>
                  <button
                    className="secondaryButton"
                    onClick={() =>
                      navigator.clipboard.writeText(revealed.value)
                    }
                    type="button"
                  >
                    <Copy size={15} /> Copiar
                  </button>
                </div>
              </div>
            ) : null}
            <footer className="securityActions secretCardActions">
              {canReveal &&
              canActOnSecret("secrets.value.reveal", secret) &&
              secret.contentKind === "file" ? (
                <button
                  className="secondaryButton"
                  onClick={() => download(secret)}
                  type="button"
                >
                  <Download size={15} /> Baixar
                </button>
              ) : null}
              {canReveal &&
              canActOnSecret("secrets.value.reveal", secret) &&
              secret.contentKind !== "file" ? (
                <button
                  className="secondaryButton"
                  onClick={() => reveal(secret)}
                  type="button"
                >
                  <Eye size={15} /> Revelar
                </button>
              ) : null}
              {canWrite && canActOnSecret("secrets.value.write", secret) ? (
                <button
                  className="secondaryButton"
                  onClick={() => setVersioning(secret)}
                  type="button"
                >
                  <RotateCw size={15} /> Nova versão
                </button>
              ) : null}
              {canArchive && canActOnSecret("secrets.archive", secret) ? (
                <button
                  className="dangerButton"
                  onClick={() => archive(secret)}
                  type="button"
                >
                  <Archive size={15} /> Arquivar
                </button>
              ) : null}
            </footer>
          </article>
        ))}
      </div>
      {creating ? (
        <CreateSecretDialog
          actor={actor}
          applications={applications}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await load();
          }}
        />
      ) : null}
      {versioning ? (
        <SecretValueDialog
          onClose={() => setVersioning(null)}
          onSaved={async () => {
            setVersioning(null);
            setRevealed(null);
            await load();
          }}
          secret={versioning}
        />
      ) : null}
    </section>
  );
}
