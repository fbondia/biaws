import { UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  createUser,
  listPermissionGroups,
  listUsers,
  resetUserPassword,
  revokeUserSessions,
  setUserGroups,
  setUserDisabled,
} from "../../api.js";
import { hasEveryPermission, hasPermission } from "../../permissions.js";
import { useLoading } from "../shared/LoadingProvider.jsx";

function toggleId(values, id) {
  return values.includes(id)
    ? values.filter((value) => value !== id)
    : [...values, id];
}

export function UsersView({ actor }) {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [accessByUser, setAccessByUser] = useState({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    groupIds: [],
  });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { runWithLoading } = useLoading();
  const canCreate = hasPermission(actor, "users.create");
  const canDisable = hasPermission(actor, "users.disable");
  const canResetPassword = hasPermission(actor, "users.password.reset");
  const canManageGroups = hasEveryPermission(
    actor,
    "users.update",
    "roles.manage",
  );
  const canReadGroups = hasPermission(actor, "roles.read");

  async function load() {
    return runWithLoading(async () => {
      try {
        const [userPayload, groupPayload] = await Promise.all([
          listUsers(),
          canReadGroups
            ? listPermissionGroups()
            : Promise.resolve({ groups: [] }),
        ]);
        const loadedUsers = userPayload.users || [];
        setUsers(loadedUsers);
        setGroups((groupPayload.groups || []).filter(({ active }) => active));
        setAccessByUser(
          Object.fromEntries(
            loadedUsers.map((user) => [user.id, user.groupIds || []]),
          ),
        );
      } catch (loadError) {
        setError(loadError.message);
      }
    }, "Carregando usuários…");
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!creating) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape" && !saving) setCreating(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [creating, saving]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await runWithLoading(async () => {
        const payload = await createUser(form);
        if (form.groupIds.length > 0) {
          await setUserGroups(payload.user.id, form.groupIds);
        }
        setForm({ name: "", email: "", password: "", groupIds: [] });
        setCreating(false);
        await load();
      }, "Criando usuário…");
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(user) {
    const newPassword = window.prompt(`Nova senha para ${user.email}:`);
    if (!newPassword) return;
    try {
      await runWithLoading(async () => {
        await resetUserPassword(user.id, newPassword);
        await revokeUserSessions(user.id);
      }, "Redefinindo senha…");
    } catch (resetError) {
      setError(resetError.message);
    }
  }

  async function changeUserGroup(user, group) {
    const current = accessByUser[user.id] || [];
    const groupIds = current.includes(group.id)
      ? current.filter((id) => id !== group.id)
      : [...current, group.id];
    try {
      await runWithLoading(
        () => setUserGroups(user.id, groupIds),
        "Atualizando grupos do usuário…",
      );
      setAccessByUser((access) => ({ ...access, [user.id]: groupIds }));
    } catch (groupError) {
      setError(groupError.message);
    }
  }

  function userGroupChangeHandler(user, group) {
    return () => void changeUserGroup(user, group);
  }

  function formGroupChangeHandler(groupId) {
    return () =>
      setForm((current) => ({
        ...current,
        groupIds: toggleId(current.groupIds, groupId),
      }));
  }

  return (
    <section className="securityView">
      <header className="securityHeader">
        <div>
          <h2>Usuários</h2>
        </div>
        {canCreate ? (
          <button
            className="primaryButton"
            onClick={() => {
              setError("");
              setCreating(true);
            }}
            type="button"
          >
            <UserPlus size={16} />
            Novo usuário
          </button>
        ) : null}
      </header>
      {error ? <div className="authError">{error}</div> : null}
      <div className="securityPanel">
        <div className="userTable">
          {users.map((user) => (
            <div className="userRow" key={user.id}>
              <div>
                <strong>{user.name}</strong>
                <small>
                  {user.email} · {user.role || "user"}
                </small>
                {canManageGroups ? (
                  <div className="userGroupPicker compact">
                    {groups.map((group) => (
                      <label key={group.id}>
                        <input
                          checked={(accessByUser[user.id] || []).includes(
                            group.id,
                          )}
                          onChange={userGroupChangeHandler(user, group)}
                          type="checkbox"
                        />
                        {group.name}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                {canResetPassword ? (
                  <button
                    className="secondaryButton"
                    onClick={() => resetPassword(user)}
                    type="button"
                  >
                    Redefinir senha
                  </button>
                ) : null}
                {canDisable ? (
                  <button
                    className="secondaryButton"
                    onClick={async () => {
                      setError("");
                      try {
                        await runWithLoading(
                          async () => {
                            await setUserDisabled(user.id, !user.banned);
                            await load();
                          },
                          user.banned
                            ? "Ativando usuário…"
                            : "Desativando usuário…",
                        );
                      } catch (statusError) {
                        setError(statusError.message);
                      }
                    }}
                    type="button"
                  >
                    {user.banned ? "Ativar" : "Desativar"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {creating ? (
        <div
          className="dialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setCreating(false);
          }}
        >
          <section
            aria-labelledby="createUserDialogTitle"
            aria-modal="true"
            className="userCreateDialog"
            role="dialog"
          >
            <header className="userCreateDialogHeader">
              <div>
                <span>Administração de usuários</span>
                <h2 id="createUserDialogTitle">Novo usuário</h2>
              </div>
              <button
                aria-label="Fechar"
                className="iconButton"
                disabled={saving}
                onClick={() => setCreating(false)}
                title="Fechar"
                type="button"
              >
                <X size={18} />
              </button>
            </header>
            <form className="userCreateDialogForm" onSubmit={submit}>
              {error ? <div className="authError">{error}</div> : null}
              <label>
                <span>Nome</span>
                <input
                  autoFocus
                  disabled={saving}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                  value={form.name}
                />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  disabled={saving}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  required
                  type="email"
                  value={form.email}
                />
              </label>
              <label>
                <span>Senha inicial</span>
                <input
                  disabled={saving}
                  minLength={12}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  required
                  type="password"
                  value={form.password}
                />
                <small>Use pelo menos 12 caracteres.</small>
              </label>
              {canManageGroups ? (
                <fieldset className="userCreateGroups">
                  <legend>Grupos do workspace</legend>
                  <div className="userGroupPicker">
                    {groups.map((group) => (
                      <label key={group.id}>
                        <input
                          checked={form.groupIds.includes(group.id)}
                          disabled={saving}
                          onChange={formGroupChangeHandler(group.id)}
                          type="checkbox"
                        />
                        {group.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <footer className="userCreateDialogFooter">
                <button
                  className="secondaryButton"
                  disabled={saving}
                  onClick={() => setCreating(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="primaryButton"
                  disabled={saving}
                  type="submit"
                >
                  <UserPlus size={16} />
                  {saving ? "Criando..." : "Criar usuário"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
