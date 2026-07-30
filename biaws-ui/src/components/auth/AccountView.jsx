import {
  Copy,
  KeyRound,
  LockKeyhole,
  LogOut,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  changePassword,
  createApiKey,
  deleteApiKey,
  listApiKeys,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from "../../api.js";
import { hasPermission } from "../../permissions.js";

const EMPTY_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function passwordErrorMessage(error) {
  if (error.code === "INVALID_PASSWORD") return "A senha atual está incorreta.";
  if (error.code === "PASSWORD_TOO_SHORT")
    return "A nova senha deve ter pelo menos 12 caracteres.";
  if (error.code === "PASSWORD_TOO_LONG")
    return "A nova senha deve ter no máximo 128 caracteres.";
  if (error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
    return "Esta conta não possui uma senha que possa ser alterada.";
  }
  return error.message;
}

function ChangePasswordDialog({ onChanged, onClose }) {
  const [form, setForm] = useState(EMPTY_PASSWORD_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("A confirmação da nova senha não corresponde.");
      return;
    }

    if (form.currentPassword === form.newPassword) {
      setError("A nova senha deve ser diferente da senha atual.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      onChanged();
    } catch (changeError) {
      setError(passwordErrorMessage(changeError));
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
        aria-labelledby="changePasswordDialogTitle"
        aria-modal="true"
        className="userCreateDialog changePasswordDialog"
        role="dialog"
      >
        <header className="userCreateDialogHeader">
          <div>
            <span>Segurança da conta</span>
            <h2 id="changePasswordDialogTitle">Trocar senha</h2>
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

        <form className="userCreateDialogForm" onSubmit={submit}>
          {error ? <div className="authError">{error}</div> : null}
          <label>
            <span>Senha atual</span>
            <input
              autoComplete="current-password"
              autoFocus
              disabled={saving}
              onChange={(event) =>
                setForm({ ...form, currentPassword: event.target.value })
              }
              required
              type="password"
              value={form.currentPassword}
            />
          </label>
          <label>
            <span>Nova senha</span>
            <input
              autoComplete="new-password"
              disabled={saving}
              maxLength={128}
              minLength={12}
              onChange={(event) =>
                setForm({ ...form, newPassword: event.target.value })
              }
              required
              type="password"
              value={form.newPassword}
            />
            <small>Use entre 12 e 128 caracteres.</small>
          </label>
          <label>
            <span>Confirmar nova senha</span>
            <input
              autoComplete="new-password"
              disabled={saving}
              maxLength={128}
              minLength={12}
              onChange={(event) =>
                setForm({ ...form, confirmPassword: event.target.value })
              }
              required
              type="password"
              value={form.confirmPassword}
            />
          </label>
          <footer className="userCreateDialogFooter">
            <button
              className="secondaryButton"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button className="primaryButton" disabled={saving} type="submit">
              <Save size={16} />
              {saving ? "Alterando..." : "Alterar senha"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function AccountView({ actor, onSignOut }) {
  const [sessions, setSessions] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [keyName, setKeyName] = useState("");
  const [createdSecret, setCreatedSecret] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const canManageApiKeys = hasPermission(actor, "api_keys.manage.self");

  async function load() {
    setError("");
    try {
      const [sessionPayload, keyPayload] = await Promise.all([
        listSessions(),
        canManageApiKeys ? listApiKeys() : Promise.resolve({ apiKeys: [] }),
      ]);
      setSessions(Array.isArray(sessionPayload) ? sessionPayload : []);
      setApiKeys(keyPayload.apiKeys || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addKey(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await createApiKey(keyName);
      setCreatedSecret(result.key);
      setKeyName("");
      await load();
    } catch (createError) {
      setError(createError.message);
    }
  }

  return (
    <section className="securityView">
      <header className="securityHeader">
        <div>
          <h2>Minha conta</h2>
          <p>
            {actor.displayName} · {actor.email}
          </p>
        </div>
        <div className="accountHeaderActions">
          <button
            className="secondaryButton"
            onClick={() => {
              setSuccessMessage("");
              setPasswordDialogOpen(true);
            }}
            type="button"
          >
            <LockKeyhole size={16} /> Trocar senha
          </button>
          <button className="secondaryButton" onClick={onSignOut} type="button">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      {error ? <div className="authError">{error}</div> : null}
      {successMessage ? (
        <div className="authSuccess">{successMessage}</div>
      ) : null}

      {canManageApiKeys && createdSecret ? (
        <div className="secretNotice">
          <strong>Copie a chave agora. Ela não será exibida novamente.</strong>
          <code>{createdSecret}</code>
          <button
            className="secondaryButton"
            onClick={() => navigator.clipboard.writeText(createdSecret)}
            type="button"
          >
            <Copy size={15} /> Copiar
          </button>
        </div>
      ) : null}

      <div className="securityGrid">
        {canManageApiKeys ? (
          <article className="securityPanel">
            <h3>
              <KeyRound size={18} /> Chaves de API
            </h3>
            <form className="inlineCreateForm" onSubmit={addKey}>
              <input
                maxLength={32}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder="Nome da chave"
                required
                value={keyName}
              />
              <button className="primaryButton" type="submit">
                Criar chave
              </button>
            </form>
            <div className="securityList">
              {apiKeys.map((key) => (
                <div className="securityListItem" key={key.id}>
                  <div>
                    <strong>{key.name}</strong>
                    <small>
                      {key.start || key.prefix || "biaws_"}… · expira em{" "}
                      {new Date(key.expiresAt).toLocaleDateString()}
                    </small>
                  </div>
                  <button
                    className="iconButton"
                    onClick={async () => {
                      await deleteApiKey(key.id);
                      await load();
                    }}
                    title="Revogar chave"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!apiKeys.length ? (
                <p className="emptyText">Nenhuma chave criada.</p>
              ) : null}
            </div>
          </article>
        ) : null}

        <article className="securityPanel">
          <header className="securityPanelHeader">
            <h3>Sessões ativas</h3>
            <button
              className="secondaryButton"
              onClick={async () => {
                await revokeOtherSessions();
                await load();
              }}
              type="button"
            >
              Revogar outras sessões
            </button>
          </header>
          <div className="securityList">
            {sessions.map((session) => (
              <div className="securityListItem" key={session.id}>
                <div>
                  <strong>{session.userAgent || "Cliente desconhecido"}</strong>
                  <small>
                    {session.ipAddress || "IP não informado"} · expira em{" "}
                    {new Date(session.expiresAt).toLocaleString()}
                  </small>
                </div>
                {session.id !== actor.sessionId ? (
                  <button
                    className="iconButton"
                    onClick={async () => {
                      await revokeSession(session.token);
                      await load();
                    }}
                    title="Revogar sessão"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <small className="currentSessionLabel">Atual</small>
                )}
              </div>
            ))}
          </div>
        </article>
      </div>

      {passwordDialogOpen ? (
        <ChangePasswordDialog
          onChanged={() => {
            setPasswordDialogOpen(false);
            setSuccessMessage("Senha alterada com sucesso.");
          }}
          onClose={() => setPasswordDialogOpen(false)}
        />
      ) : null}
    </section>
  );
}
