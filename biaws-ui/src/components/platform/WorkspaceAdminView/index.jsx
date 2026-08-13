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

import "../../../styles/features/platform.css";

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
} from "../../../api.js";
import { useMessages } from "../../../infrastructure/messages/MessagesProvider.jsx";
import { WorkspaceDetail } from "./components/WorkspaceAdminPanels.jsx";
import { WorkspaceFormDialog } from "./components/WorkspaceFormDialog.jsx";

export function WorkspaceAdminView({ actor }) {
  const { confirm, prompt } = useMessages();
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

  async function changeStatus() {
    try {
      if (selected.status === "active") {
        const confirmation = await prompt({
          confirmLabel: "Arquivar workspace",
          inputLabel: "Nome do workspace",
          message: `Digite “${selected.name}” para arquivar.`,
          required: true,
          title: "Arquivar workspace",
        });
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
      !(await confirm({
        message: `Remover ${member.email || member.userId} deste workspace?`,
        tone: "danger",
      }))
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
          <WorkspaceDetail
            availableUsers={availableUsers}
            draft={draft}
            events={events}
            groups={groups}
            members={members}
            newMember={newMember}
            onAdd={addMember}
            onDraftChange={setDraft}
            onNewMemberChange={setNewMember}
            onRemove={removeMember}
            onSave={saveMember}
            onStatusChange={changeStatus}
            onTabChange={setTab}
            selected={selected}
            selectedId={selected?.id}
            summary={summary}
            tab={tab}
            {...(tab === "general" ? { onSave: saveGeneral } : {})}
          />
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
