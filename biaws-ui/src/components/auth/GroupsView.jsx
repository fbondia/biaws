import { ChevronDown, CopyPlus, Plus, Save, ShieldCheck } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import {
  createPermissionGroup,
  fetchApplications,
  listPermissionCatalog,
  listPermissionGroups,
  replicatePermissionGroup,
  setPermissionGroupActive,
  updatePermissionGroup,
} from "../../api.js";
import { hasPermission } from "../../permissions.js";

import { groupPermissionsBySection } from "./groupsModel.js";
import { ReplicationDialog } from "../shared/ReplicationDialog.jsx";
import {
  CreateGroupButton,
  PermissionCategories,
} from "./GroupsViewPanels.jsx";

function permissionsForScope(permissions, catalog, type) {
  if (type !== "applications") return permissions;
  return permissions.filter(
    (id) =>
      catalog.find((permission) => permission.id === id)?.scope !== "workspace",
  );
}
import { useMessages } from "../../infrastructure/messages/MessagesProvider.jsx";

const EMPTY_GROUP = {
  identifier: "",
  name: "",
  description: "",
  permissions: [],
  scope: { type: "workspace", applicationIds: [] },
};

export function GroupsView({ actor }) {
  const [groups, setGroups] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [applications, setApplications] = useState([]);
  const [draft, setDraft] = useState(EMPTY_GROUP);
  const [selectedId, setSelectedId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [activePermissionDomain, setActivePermissionDomain] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [replicationOpen, setReplicationOpen] = useState(false);
  const permissionCategoriesId = useId();
  const { run: runWithLoading } = useMessages();
  const canManage = hasPermission(actor, "roles.manage");

  const domains = useMemo(
    () =>
      Object.entries(
        catalog.reduce((result, permission) => {
          (result[permission.domain] ||= []).push(permission);
          return result;
        }, {}),
      ),
    [catalog],
  );
  async function load(preferredId) {
    return runWithLoading(async () => {
      try {
        const [groupPayload, catalogPayload, applicationPayload] =
          await Promise.all([
            listPermissionGroups(),
            listPermissionCatalog(),
            fetchApplications(actor.workspaceId, {
              includeArchived: true,
              limit: 100,
            }),
          ]);
        setGroups(groupPayload.groups || []);
        setCatalog(catalogPayload.permissions || []);
        setApplications(applicationPayload.items || []);
        const selected = (groupPayload.groups || []).find(
          ({ id }) => id === (preferredId || selectedId),
        );
        if (selected) setDraft(selected);
      } catch (loadError) {
        setError(loadError.message);
      }
    }, "Carregando grupos e permissões…");
  }

  useEffect(() => {
    load();
  }, []);

  function selectGroup(group) {
    setReplicationOpen(false);
    setSelectedId(group.id);
    setEditorOpen(true);
    setDraft({
      ...group,
      permissions: [...group.permissions],
      scope: {
        type: group.scope?.type || "workspace",
        applicationIds: [...(group.scope?.applicationIds || [])],
      },
    });
    setError("");
  }

  function startNew() {
    setReplicationOpen(false);
    setSelectedId("");
    setEditorOpen(true);
    setDraft(EMPTY_GROUP);
    setError("");
  }

  function togglePermission(permissionId) {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionId)
        ? current.permissions.filter((id) => id !== permissionId)
        : [...current.permissions, permissionId],
    }));
  }

  function setScopeType(type) {
    setDraft((current) => ({
      ...current,
      permissions: permissionsForScope(current.permissions, catalog, type),
      scope: {
        type,
        applicationIds:
          type === "applications" ? current.scope?.applicationIds || [] : [],
      },
    }));
  }

  function toggleApplication(applicationId) {
    setDraft((current) => {
      const selected = current.scope?.applicationIds || [];
      return {
        ...current,
        scope: {
          type: "applications",
          applicationIds: selected.includes(applicationId)
            ? selected.filter((id) => id !== applicationId)
            : [...selected, applicationId],
        },
      };
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await runWithLoading(
        async () => {
          const payload = selectedId
            ? await updatePermissionGroup(selectedId, draft)
            : await createPermissionGroup(draft);
          setSelectedId(payload.group.id);
          setDraft(payload.group);
          await load(payload.group.id);
        },
        selectedId ? "Salvando grupo…" : "Criando grupo…",
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setError("");
    try {
      await runWithLoading(
        async () => {
          const payload = await setPermissionGroupActive(
            selectedId,
            !draft.active,
          );
          setDraft(payload.group);
          await load(selectedId);
        },
        draft.active ? "Desativando grupo…" : "Reativando grupo…",
      );
    } catch (statusError) {
      setError(statusError.message);
    }
  }

  return (
    <section className="securityView">
      <header className="securityHeader">
        <div>
          <h2>Grupos de permissões</h2>
          <p>Defina o alcance e os acessos de cada perfil do workspace.</p>
        </div>
        <CreateGroupButton canManage={canManage} onCreate={startNew} />
      </header>
      {error ? <div className="authError">{error}</div> : null}
      <div className="groupAdminLayout">
        <aside className="securityPanel groupList">
          <div className="groupListHeader">
            <span>Grupos disponíveis</span>
            <strong>{groups.length}</strong>
          </div>
          {groups.map((group) => (
            <button
              className={
                selectedId === group.id
                  ? "groupListItem selected"
                  : "groupListItem"
              }
              key={group.id}
              onClick={() => selectGroup(group)}
              type="button"
            >
              <span>
                <ShieldCheck size={16} /> {group.name}
              </span>
              <small>
                {group.system ? "Sistema" : "Personalizado"} ·{" "}
                {group.permissions.length} permissões
                {!group.active ? " · Inativo" : ""}
              </small>
            </button>
          ))}
        </aside>
        {editorOpen ? (
          <form className="securityPanel groupEditor" onSubmit={save}>
            {!draft.system ? (
              <label>
                <span>Identificador</span>
                <input
                  disabled={!canManage}
                  maxLength={80}
                  onChange={(event) =>
                    setDraft({ ...draft, identifier: event.target.value })
                  }
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="exemplo-estavel"
                  value={draft.identifier || ""}
                />
                <small>Usado para localizar o grupo ao replicar.</small>
              </label>
            ) : null}
            <label>
              <span>Nome</span>
              <input
                maxLength={100}
                disabled={!canManage}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                required
                value={draft.name}
              />
            </label>
            <label>
              <span>Descrição</span>
              <textarea
                maxLength={500}
                disabled={!canManage}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                rows={3}
                value={draft.description}
              />
            </label>
            <fieldset className="permissionDomain">
              <legend>Escopo</legend>
              <label className="permissionOption scopeOption">
                <input
                  checked={draft.scope?.type !== "applications"}
                  disabled={!canManage}
                  name="groupScope"
                  onChange={() => setScopeType("workspace")}
                  type="radio"
                />
                <span>
                  Workspace inteiro
                  <small>Todas as aplicações e recursos gerais</small>
                </span>
              </label>
              <label className="permissionOption scopeOption">
                <input
                  checked={draft.scope?.type === "applications"}
                  disabled={!canManage}
                  name="groupScope"
                  onChange={() => setScopeType("applications")}
                  type="radio"
                />
                <span>
                  Aplicações específicas
                  <small>Somente os produtos selecionados</small>
                </span>
              </label>
              {draft.scope?.type === "applications" ? (
                <div className="scopeApplicationList">
                  {applications.map((application) => (
                    <label className="permissionOption" key={application.id}>
                      <input
                        checked={draft.scope.applicationIds.includes(
                          application.id,
                        )}
                        disabled={!canManage}
                        onChange={() => toggleApplication(application.id)}
                        type="checkbox"
                      />
                      <span>
                        {application.name}
                        <small>{application.key}</small>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </fieldset>
            <PermissionCategories
              activeDomain={activePermissionDomain}
              canManage={canManage}
              categoriesId={permissionCategoriesId}
              domains={domains}
              draft={draft}
              onToggleDomain={setActivePermissionDomain}
              onTogglePermission={togglePermission}
            />
            <div className="securityActions">
              {canManage ? (
                <button
                  className="primaryButton"
                  disabled={saving}
                  type="submit"
                >
                  <Save size={16} /> {saving ? "Salvando…" : "Salvar grupo"}
                </button>
              ) : null}
              {canManage && selectedId ? (
                <button
                  className="secondaryButton"
                  onClick={toggleActive}
                  type="button"
                >
                  {draft.active ? "Desativar" : "Reativar"}
                </button>
              ) : null}
              {selectedId &&
              actor.workspaces?.some(({ id }) => id !== actor.workspaceId) ? (
                <button
                  className="secondaryButton"
                  onClick={() => setReplicationOpen(true)}
                  type="button"
                >
                  <CopyPlus size={16} /> Replicar
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="securityPanel groupEditor">
            <div className="emptyState">Selecione um grupo ou crie um novo</div>
          </div>
        )}
      </div>
      <ReplicationDialog
        currentWorkspaceId={actor.workspaceId}
        description={
          <p>
            O nome, a descrição, as permissões e o escopo serão replicados, sem
            copiar membros. Escopos de aplicação são associados por meio do
            identificador das aplicações no destino. Grupos de sistema
            substituem o grupo correspondente; grupos personalizados são criados
            ou substituídos pelo identificador.
          </p>
        }
        eyebrow={draft.name}
        onClose={() => setReplicationOpen(false)}
        onReplicate={(destinationWorkspaceIds) =>
          replicatePermissionGroup(selectedId, destinationWorkspaceIds)
        }
        open={replicationOpen}
        resourceKey={selectedId}
        title="Replicar grupo de permissões"
        workspaces={actor.workspaces || []}
      />
    </section>
  );
}
