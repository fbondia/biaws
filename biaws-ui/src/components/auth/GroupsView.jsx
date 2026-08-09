import { ChevronDown, Plus, Save, ShieldCheck } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import {
  createPermissionGroup,
  fetchApplications,
  listPermissionCatalog,
  listPermissionGroups,
  setPermissionGroupActive,
  updatePermissionGroup,
} from "../../api.js";
import { hasPermission } from "../../permissions.js";

import { groupPermissionsBySection } from "./groupsModel.js";

function permissionsForScope(permissions, catalog, type) {
  if (type !== "applications") return permissions;
  return permissions.filter(
    (id) =>
      catalog.find((permission) => permission.id === id)?.scope !== "workspace",
  );
}
import { useLoading } from "../shared/LoadingProvider.jsx";

const EMPTY_GROUP = {
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
  const permissionCategoriesId = useId();
  const { runWithLoading } = useLoading();
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
        {canManage ? (
          <button className="primaryButton" onClick={startNew} type="button">
            <Plus size={16} /> Novo grupo
          </button>
        ) : null}
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
            <section
              aria-label="Categorias de permissões"
              className="permissionCategoriesSection"
            >
              <div className="permissionCategoriesHeader">
                <div>
                  <h3>Permissões</h3>
                  <p>Expanda uma categoria para configurar as permissões.</p>
                </div>
                <span>
                  {draft.permissions.length}{" "}
                  {draft.permissions.length === 1
                    ? "selecionada"
                    : "selecionadas"}
                </span>
              </div>
              <div className="permissionCategoryList">
                {domains.map(([domain, permissions], index) => {
                  const selectedCount = permissions.filter(({ id }) =>
                    draft.permissions.includes(id),
                  ).length;
                  const isExpanded = domain === activePermissionDomain;
                  const sections = groupPermissionsBySection(permissions);
                  return (
                    <article
                      className={
                        isExpanded
                          ? "permissionCategory expanded"
                          : "permissionCategory"
                      }
                      key={domain}
                    >
                      <button
                        aria-controls={`${permissionCategoriesId}-panel-${index}`}
                        aria-expanded={isExpanded}
                        className="permissionCategoryTrigger"
                        id={`${permissionCategoriesId}-trigger-${index}`}
                        onClick={() =>
                          setActivePermissionDomain(isExpanded ? "" : domain)
                        }
                        type="button"
                      >
                        <span className="permissionCategoryTitle">
                          <strong>{domain}</strong>
                          <small>
                            {permissions.length}{" "}
                            {permissions.length === 1
                              ? "permissão disponível"
                              : "permissões disponíveis"}
                          </small>
                        </span>
                        <span className="permissionCategorySummary">
                          <span
                            aria-label={`${selectedCount} de ${permissions.length} permissões selecionadas`}
                            className="permissionCategoryBadge"
                          >
                            {selectedCount}/{permissions.length}
                          </span>
                          <ChevronDown
                            aria-hidden="true"
                            className="permissionCategoryChevron"
                            size={18}
                          />
                        </span>
                      </button>
                      {isExpanded ? (
                        <div
                          aria-labelledby={`${permissionCategoriesId}-trigger-${index}`}
                          className="permissionCategoryPanel"
                          id={`${permissionCategoriesId}-panel-${index}`}
                          role="region"
                        >
                          {sections.map(([section, sectionPermissions]) => (
                            <section
                              className="permissionSection"
                              key={section}
                            >
                              <h4>{section}</h4>
                              <div className="permissionSectionOptions">
                                {sectionPermissions.map((permission) => (
                                  <label
                                    className="permissionOption"
                                    key={permission.id}
                                  >
                                    <input
                                      checked={draft.permissions.includes(
                                        permission.id,
                                      )}
                                      disabled={
                                        !canManage ||
                                        (draft.scope?.type === "applications" &&
                                          permission.scope === "workspace")
                                      }
                                      onChange={() =>
                                        togglePermission(permission.id)
                                      }
                                      type="checkbox"
                                    />
                                    <span>
                                      {permission.label}
                                      <small>{permission.id}</small>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
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
            </div>
          </form>
        ) : (
          <div className="securityPanel groupEditor">
            <div className="emptyState">Selecione um grupo ou crie um novo</div>
          </div>
        )}
      </div>
    </section>
  );
}
