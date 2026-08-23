import { Archive, Plus, RotateCcw, Save, UserPlus, X } from "lucide-react";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";
import { useState, useEffect } from "react";

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

function toggleId(ids, id) {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
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
                  setGroupIds((current) => toggleId(current, group.id))
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

function GeneralWorkspaceTab({
  draft,
  onDraftChange,
  onSave,
  onStatusChange,
  selected,
}) {
  return (
    <form className="platformGeneralForm" onSubmit={onSave}>
      <label>
        <span>Nome</span>
        <input
          onChange={(event) =>
            onDraftChange({ ...draft, name: event.target.value })
          }
          required
          value={draft.name}
        />
      </label>
      <label>
        <span>UUID</span>
        <div className="platformUuidField">
          <EntityIdentifier
            label="UUID do workspace"
            value={selected.id}
            variant="chip"
          />
        </div>
      </label>
      <label>
        <span>Descrição</span>
        <textarea
          onChange={(event) =>
            onDraftChange({ ...draft, description: event.target.value })
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
            selected.status === "active" ? "dangerButton" : "secondaryButton"
          }
          disabled={selected.default}
          onClick={onStatusChange}
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
  );
}

function MembersWorkspaceTab({
  availableUsers,
  groups,
  members,
  newMember,
  onAdd,
  onNewMemberChange,
  onRemove,
  onSave,
  selectedId,
}) {
  const activeGroups = groups.filter(({ active }) => active);
  function toggleNewMemberGroup(groupId) {
    onNewMemberChange({
      ...newMember,
      groupIds: toggleId(newMember.groupIds, groupId),
    });
  }
  return (
    <div className="platformMembers">
      <form className="platformAddMember" onSubmit={onAdd}>
        <select
          onChange={(event) =>
            onNewMemberChange({ ...newMember, userId: event.target.value })
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
          {activeGroups.map((group) => (
            <label key={group.id}>
              <input
                checked={newMember.groupIds.includes(group.id)}
                onChange={() => toggleNewMemberGroup(group.id)}
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
            key={`${selectedId}:${member.userId}`}
            member={member}
            onRemove={onRemove}
            onSave={onSave}
          />
        ))}
      </div>
    </div>
  );
}

function GroupsWorkspaceTab({ groups }) {
  return (
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
  );
}

function InventoryWorkspaceTab({ summary }) {
  const metrics = {
    Membros: summary.members,
    Grupos: summary.groups,
    Aplicações: summary.applications,
    Servidores: summary.servers,
    Chamados: summary.issues,
    Melhorias: summary.demands,
  };
  return (
    <div className="platformMetrics">
      {Object.entries(metrics).map(([label, value]) => (
        <article key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </article>
      ))}
    </div>
  );
}

function AuditWorkspaceTab({ events }) {
  if (!events.length) {
    return <div className="emptyState">Nenhum evento registrado.</div>;
  }
  return (
    <div className="platformAuditList">
      {events.map((event) => (
        <article key={event.id}>
          <strong>{event.summary || event.action}</strong>
          <span>
            {event.actor?.displayName || event.actor?.email || "Sistema"} ·{" "}
            {formatDate(event.occurredAt)}
          </span>
        </article>
      ))}
    </div>
  );
}

function WorkspaceTabContent({ tab, ...props }) {
  if (tab === "general") return <GeneralWorkspaceTab {...props} />;
  if (tab === "members") return <MembersWorkspaceTab {...props} />;
  if (tab === "groups") return <GroupsWorkspaceTab {...props} />;
  if (tab === "inventory" && props.summary) {
    return <InventoryWorkspaceTab summary={props.summary} />;
  }
  if (tab === "audit") return <AuditWorkspaceTab events={props.events} />;
  return null;
}

export function WorkspaceDetail({ onTabChange, selected, tab, ...tabProps }) {
  if (!selected) {
    return <div className="emptyState">Selecione um workspace.</div>;
  }
  return (
    <>
      <header className="platformDetailHeader">
        <div>
          <h3>{selected.name}</h3>
          <EntityIdentifier
            label="Identificador do workspace"
            value={selected.key}
            variant="eyebrow"
          />
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
            onClick={() => onTabChange(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      <WorkspaceTabContent {...tabProps} selected={selected} tab={tab} />
    </>
  );
}
