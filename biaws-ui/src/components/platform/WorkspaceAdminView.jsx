import {
  Archive,
  Building2,
  Check,
  Copy,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  archivePlatformWorkspace,
  createPlatformWorkspace,
  getPlatformWorkspaceSummary,
  listPlatformUsers,
  listPlatformWorkspaceAudit,
  listPlatformWorkspaceGroups,
  listPlatformWorkspaceMembers,
  listPlatformWorkspaces,
  reactivatePlatformWorkspace,
  removePlatformWorkspaceMember,
  setPlatformWorkspaceMember,
  updatePlatformWorkspace,
} from "../../api.js";

const EMPTY_FORM = {
  key: "",
  name: "",
  description: "",
  administratorUserId: "",
};
const TABS = [
  ["general", "Geral"],
  ["members", "Membros"],
  ["groups", "Grupos"],
  ["inventory", "Inventário"],
  ["audit", "Auditoria"],
];

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function WorkspaceFormDialog({ actor, onClose, onCreated, users }) {
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
        <header className="dialogHeader">
          <div className="dialogTitleBlock">
            <span className="dialogKicker">Administração global</span>
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

function MemberEditor({ groups, member, onRemove, onSave }) {
  const [groupIds, setGroupIds] = useState(member.groupIds || []);
  useEffect(() => {
    setGroupIds(member.groupIds || []);
  }, [member.userId, member.groupIds]);
  return (
    <article className="platformMemberCard">
      <div>
        <strong>{member.name || member.email || member.userId}</strong>
        <small>{member.email || member.userId}</small>
      </div>
      <div className="platformGroupChecks">
        {groups
          .filter(({ active }) => active)
          .map((group) => (
            <label key={group.id}>
              <input
                checked={groupIds.includes(group.id)}
                onChange={() =>
                  setGroupIds((current) =>
                    current.includes(group.id)
                      ? current.filter((id) => id !== group.id)
                      : [...current, group.id],
                  )
                }
                type="checkbox"
              />
              {group.name}
            </label>
          ))}
      </div>
      <div className="platformMemberActions">
        <button
          className="secondaryButton"
          onClick={() => onSave(member.userId, groupIds)}
          type="button"
        >
          <Save size={15} /> Salvar
        </button>
        <button
          className="dangerButton"
          onClick={() => onRemove(member)}
          type="button"
        >
          Remover
        </button>
      </div>
    </article>
  );
}

export function WorkspaceAdminView({ actor }) {
  const detailRequestId = useRef(0);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("general");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [newMember, setNewMember] = useState({ userId: "", groupIds: [] });
  const [uuidCopied, setUuidCopied] = useState(false);
  const [error, setError] = useState("");

  async function loadWorkspaces() {
    try {
      setError("");
      const payload = await listPlatformWorkspaces({
        q: query,
        status,
        limit: 100,
      });
      const items = payload.items || [];
      setWorkspaces(items);
      if (!items.some(({ id }) => id === selectedId)) {
        setSelectedId(items[0]?.id || "");
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadDetails(workspaceId) {
    const requestId = ++detailRequestId.current;
    if (!workspaceId) {
      setSelected(null);
      return;
    }
    try {
      setError("");
      const workspace = workspaces.find(({ id }) => id === workspaceId);
      const [summaryPayload, memberPayload, groupPayload, auditPayload] =
        await Promise.all([
          getPlatformWorkspaceSummary(workspaceId),
          listPlatformWorkspaceMembers(workspaceId),
          listPlatformWorkspaceGroups(workspaceId),
          listPlatformWorkspaceAudit(workspaceId),
        ]);
      if (requestId !== detailRequestId.current) return;
      setSelected(workspace || null);
      setDraft({
        name: workspace?.name || "",
        description: workspace?.description || "",
      });
      setSummary(summaryPayload.summary);
      setMembers(memberPayload.members || []);
      setGroups(groupPayload.groups || []);
      setEvents(auditPayload.events || []);
    } catch (loadError) {
      if (requestId !== detailRequestId.current) return;
      setError(loadError.message);
    }
  }

  useEffect(() => {
    Promise.all([
      loadWorkspaces(),
      listPlatformUsers().then((payload) => setUsers(payload.users || [])),
    ]).catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    loadDetails(selectedId);
  }, [selectedId, workspaces]);

  useEffect(() => {
    setUuidCopied(false);
  }, [selected?.id]);

  const availableUsers = useMemo(() => {
    const memberIds = new Set(members.map(({ userId }) => userId));
    return users.filter(({ id }) => !memberIds.has(String(id)));
  }, [members, users]);

  async function refresh() {
    await loadWorkspaces();
    await loadDetails(selectedId);
  }

  async function saveGeneral(event) {
    event.preventDefault();
    try {
      const payload = await updatePlatformWorkspace(selected.id, draft);
      setSelected(payload.workspace);
      await loadWorkspaces();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function copyWorkspaceUuid() {
    try {
      await copyPlainText(selected.id);
      setUuidCopied(true);
    } catch {
      setUuidCopied(false);
      setError("Não foi possível copiar o UUID do workspace.");
    }
  }

  async function changeStatus() {
    try {
      if (selected.status === "active") {
        const confirmation = window.prompt(
          `Digite “${selected.name}” para arquivar:`,
        );
        if (confirmation === null) return;
        await archivePlatformWorkspace(selected.id, confirmation);
      } else {
        await reactivatePlatformWorkspace(selected.id);
      }
      await refresh();
    } catch (statusError) {
      setError(statusError.message);
    }
  }

  async function saveMember(userId, groupIds) {
    try {
      await setPlatformWorkspaceMember(selected.id, userId, groupIds);
      await loadDetails(selected.id);
    } catch (memberError) {
      setError(memberError.message);
    }
  }

  async function addMember(event) {
    event.preventDefault();
    if (!newMember.userId || !newMember.groupIds.length) return;
    await saveMember(newMember.userId, newMember.groupIds);
    setNewMember({ userId: "", groupIds: [] });
  }

  async function removeMember(member) {
    if (
      !window.confirm(
        `Remover ${member.email || member.userId} deste workspace?`,
      )
    )
      return;
    try {
      await removePlatformWorkspaceMember(selected.id, member.userId);
      await loadDetails(selected.id);
    } catch (removeError) {
      setError(removeError.message);
    }
  }

  return (
    <section className="platformAdminView">
      <header className="securityHeader platformAdminHeader">
        <div>
          <span className="platformEyebrow">Plano global</span>
          <h2>Workspaces</h2>
          <p>
            Gerencie fronteiras, membros e provisionamento sem ampliar
            permissões operacionais.
          </p>
        </div>
        <div className="platformHeaderActions">
          <button className="secondaryButton" onClick={refresh} type="button">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button
            className="primaryButton"
            onClick={() => setCreating(true)}
            type="button"
          >
            <Plus size={16} /> Novo workspace
          </button>
        </div>
      </header>
      {error ? <div className="authError">{error}</div> : null}
      <div className="platformAdminLayout">
        <aside className="securityPanel platformWorkspaceList">
          <form
            className="platformFilters"
            onSubmit={(event) => {
              event.preventDefault();
              loadWorkspaces();
            }}
          >
            <input
              aria-label="Buscar workspace"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar…"
              value={query}
            />
            <select
              aria-label="Filtrar status"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="">Todos</option>
              <option value="active">Ativos</option>
              <option value="archived">Arquivados</option>
            </select>
            <button className="secondaryButton" type="submit">
              Filtrar
            </button>
          </form>
          <div className="platformWorkspaceItems">
            {workspaces.map((workspace) => (
              <button
                className={
                  workspace.id === selectedId
                    ? "platformWorkspaceItem selected"
                    : "platformWorkspaceItem"
                }
                key={workspace.id}
                onClick={() => setSelectedId(workspace.id)}
                type="button"
              >
                <span>
                  <Building2 size={16} /> {workspace.name}
                </span>
                <small>
                  {workspace.key} ·{" "}
                  {workspace.status === "active" ? "Ativo" : "Arquivado"}
                </small>
              </button>
            ))}
          </div>
        </aside>
        <div className="securityPanel platformWorkspaceDetail">
          {selected ? (
            <>
              <header className="platformDetailHeader">
                <div>
                  <h3>{selected.name}</h3>
                  <p>{selected.key}</p>
                </div>
                <span className={`platformStatus ${selected.status}`}>
                  {selected.status === "active" ? "Ativo" : "Arquivado"}
                </span>
              </header>
              <nav className="platformTabs" aria-label="Detalhes do workspace">
                {TABS.map(([key, label]) => (
                  <button
                    className={tab === key ? "tab active" : "tab"}
                    key={key}
                    onClick={() => setTab(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {tab === "general" ? (
                <form className="platformGeneralForm" onSubmit={saveGeneral}>
                  <label>
                    <span>Nome</span>
                    <input
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                      required
                      value={draft.name}
                    />
                  </label>
                  <label>
                    <span>UUID</span>
                    <div className="platformUuidField">
                      <input
                        aria-label="UUID do workspace"
                        readOnly
                        value={selected.id}
                      />
                      <button
                        aria-label={
                          uuidCopied
                            ? "UUID do workspace copiado"
                            : "Copiar UUID do workspace"
                        }
                        className="secondaryButton"
                        onClick={copyWorkspaceUuid}
                        type="button"
                      >
                        {uuidCopied ? <Check size={16} /> : <Copy size={16} />}
                        {uuidCopied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </label>
                  <label>
                    <span>Descrição</span>
                    <textarea
                      onChange={(event) =>
                        setDraft({ ...draft, description: event.target.value })
                      }
                      rows={4}
                      value={draft.description}
                    />
                  </label>
                  <div className="platformFormActions">
                    <button className="primaryButton" type="submit">
                      <Save size={16} /> Salvar
                    </button>
                    <button
                      className={
                        selected.status === "active"
                          ? "dangerButton"
                          : "secondaryButton"
                      }
                      disabled={selected.default}
                      onClick={changeStatus}
                      type="button"
                    >
                      {selected.status === "active" ? (
                        <Archive size={16} />
                      ) : (
                        <RotateCcw size={16} />
                      )}
                      {selected.status === "active" ? "Arquivar" : "Reativar"}
                    </button>
                  </div>
                  {selected.default ? (
                    <p className="platformHint">
                      O workspace padrão não pode ser arquivado.
                    </p>
                  ) : null}
                </form>
              ) : null}
              {tab === "members" ? (
                <div className="platformMembers">
                  <form className="platformAddMember" onSubmit={addMember}>
                    <select
                      onChange={(event) =>
                        setNewMember({
                          ...newMember,
                          userId: event.target.value,
                        })
                      }
                      required
                      value={newMember.userId}
                    >
                      <option value="">Selecionar usuário…</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email} · {user.email}
                        </option>
                      ))}
                    </select>
                    <div className="platformGroupChecks">
                      {groups
                        .filter(({ active }) => active)
                        .map((group) => (
                          <label key={group.id}>
                            <input
                              checked={newMember.groupIds.includes(group.id)}
                              onChange={() =>
                                setNewMember((current) => ({
                                  ...current,
                                  groupIds: current.groupIds.includes(group.id)
                                    ? current.groupIds.filter(
                                        (id) => id !== group.id,
                                      )
                                    : [...current.groupIds, group.id],
                                }))
                              }
                              type="checkbox"
                            />
                            {group.name}
                          </label>
                        ))}
                    </div>
                    <button className="primaryButton" type="submit">
                      <UserPlus size={16} /> Adicionar
                    </button>
                  </form>
                  <div className="platformMemberList">
                    {members.map((member) => (
                      <MemberEditor
                        groups={groups}
                        key={`${selected.id}:${member.userId}`}
                        member={member}
                        onRemove={removeMember}
                        onSave={saveMember}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {tab === "groups" ? (
                <div className="platformGroupList">
                  {groups.map((group) => (
                    <article key={group.id}>
                      <strong>{group.name}</strong>
                      <span>
                        {group.system ? "Sistema" : "Personalizado"} ·{" "}
                        {group.permissions.length} permissões ·{" "}
                        {group.active ? "Ativo" : "Inativo"}
                      </span>
                      <small>
                        {group.scope.type === "workspace"
                          ? "Workspace inteiro"
                          : `${group.scope.applicationIds.length} aplicações`}
                      </small>
                    </article>
                  ))}
                </div>
              ) : null}
              {tab === "inventory" && summary ? (
                <div className="platformMetrics">
                  {Object.entries({
                    Membros: summary.members,
                    Grupos: summary.groups,
                    Aplicações: summary.applications,
                    Servidores: summary.servers,
                    Chamados: summary.issues,
                    Melhorias: summary.demands,
                  }).map(([label, value]) => (
                    <article key={label}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </article>
                  ))}
                </div>
              ) : null}
              {tab === "audit" ? (
                <div className="platformAuditList">
                  {events.length ? (
                    events.map((event) => (
                      <article key={event.id}>
                        <strong>{event.summary || event.action}</strong>
                        <span>
                          {event.actor?.displayName ||
                            event.actor?.email ||
                            "Sistema"}{" "}
                          · {formatDate(event.occurredAt)}
                        </span>
                      </article>
                    ))
                  ) : (
                    <div className="emptyState">Nenhum evento registrado.</div>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="emptyState">Selecione um workspace.</div>
          )}
        </div>
      </div>
      {creating ? (
        <WorkspaceFormDialog
          actor={actor}
          onClose={() => setCreating(false)}
          onCreated={(workspace) => {
            setCreating(false);
            setSelectedId(workspace.id);
            loadWorkspaces();
          }}
          users={users}
        />
      ) : null}
    </section>
  );
}

async function copyPlainText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
