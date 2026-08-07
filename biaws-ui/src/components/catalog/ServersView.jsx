import { Archive, ArrowLeft, Pencil, Plus, Server } from "lucide-react";
import { useEffect, useState } from "react";

import {
  archiveServer,
  createServer,
  fetchApplications,
  fetchComponents,
  fetchServer,
  fetchServerDeployments,
  fetchServerRuntimes,
  fetchServers,
  fetchWorkspaces,
  moveServerToCollection,
  updateServer,
} from "../../api.js";
import { hasPermission } from "../../permissions.js";
import { AuditHistory } from "../shared/AuditHistory.jsx";
import { useResourceCollections } from "../shared/useResourceCollections.js";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionSearch,
  ResourceCollectionSidebar,
  ResourceCollectionsShell,
} from "../shared/ResourceCollections.jsx";
import { CatalogEntityDialog } from "./CatalogEntityDialog.jsx";
import { buildServerApplicationGroups } from "./serverApplicationModel.js";

export function ServersView({ actor }) {
  const [workspace, setWorkspace] = useState(null);
  const [servers, setServers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [serverApplications, setServerApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dialog, setDialog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const collectionState = useResourceCollections("servers", {
    onError: setError,
    onMoved: () => loadList(),
  });

  async function loadList(nextWorkspace = workspace, filters = {}) {
    if (!nextWorkspace?.id) return;
    const payload = await fetchServers(nextWorkspace.id, {
      q: filters.search ?? search,
      includeArchived: filters.includeArchived ?? includeArchived,
      limit: 100,
    });
    setServers(payload.items || []);
  }

  async function initialize() {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchWorkspaces();
      const operational =
        (payload.items || []).find(({ id }) => id === actor.workspaceId) ||
        null;
      setWorkspace(operational);
      await loadList(operational);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function openServer(server) {
    setLoading(true);
    setError("");
    setServerApplications([]);
    try {
      const [detail, runtimePayload, deploymentPayload] = await Promise.all([
        fetchServer(server.id),
        hasPermission(actor, "runtimes.read")
          ? fetchServerRuntimes(server.id, { limit: 100 })
          : Promise.resolve({ items: [] }),
        hasPermission(actor, "deployments.read")
          ? fetchServerDeployments(server.id, { limit: 100 })
          : Promise.resolve({ items: [] }),
      ]);
      setSelected(detail.server);
      const relatedDeployments = deploymentPayload.items || [];
      const applicationIds = [
        ...new Set(
          relatedDeployments.map(({ applicationId }) => applicationId),
        ),
      ];
      if (
        applicationIds.length &&
        hasPermission(actor, "applications.read") &&
        hasPermission(actor, "components.read")
      ) {
        const [applicationsPayload, componentPayloads] = await Promise.all([
          fetchApplications(workspace.id, { limit: 100 }),
          Promise.all(
            applicationIds.map((applicationId) =>
              fetchComponents(applicationId, { limit: 100 }),
            ),
          ),
        ]);
        setServerApplications(
          buildServerApplicationGroups({
            applications: (applicationsPayload.items || []).filter(({ id }) =>
              applicationIds.includes(id),
            ),
            components: componentPayloads.flatMap(({ items }) => items || []),
            deployments: relatedDeployments,
            runtimes: runtimePayload.items || [],
          }),
        );
      } else {
        setServerApplications([]);
      }
      setActiveTab("overview");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void initialize();
  }, [actor.workspaceId]);

  useEffect(() => {
    if (!workspace?.id) return undefined;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        await loadList(workspace, { search, includeArchived });
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [workspace?.id, search, includeArchived]);

  async function persist(payload) {
    const result = dialog?.id
      ? await updateServer(dialog.id, payload)
      : await createServer(workspace.id, payload);
    await loadList();
    if (result.server?.id) await openServer(result.server);
  }

  async function archiveSelected() {
    if (!selected || !window.confirm(`Arquivar “${selected.name}”?`)) return;
    try {
      await archiveServer(selected.id);
      setSelected(null);
      await loadList();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  const visibleServers = servers.filter(
    ({ collectionId }) =>
      String(collectionId || "") === collectionState.selectedCollectionId,
  );
  const canManageCollections = hasPermission(actor, "servers.update");

  return (
    <section className="catalogPage serversPage">
      <ServerHeader
        actor={actor}
        onCreate={() => setDialog({})}
        workspace={workspace}
      />
      {error ? <div className="errorBox">{error}</div> : null}
      <ResourceCollectionsShell
        className={[
          "serversCollectionsLayout",
          selected ? "catalogResourceSelected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        collections={collectionState.collections}
        collectionsVisible={collectionState.collectionsVisible}
        onShowCollections={() => collectionState.setCollectionsVisible(true)}
        selectedCollectionId={collectionState.selectedCollectionId}
        sidebar={
          <ResourceCollectionSidebar
            collections={collectionState.collections}
            draggedItem={collectionState.draggedItem}
            itemLabel="servidores"
            items={servers}
            onCreate={
              canManageCollections
                ? collectionState.createCollection
                : undefined
            }
            onDelete={collectionState.removeCollection}
            onClose={() => collectionState.setCollectionsVisible(false)}
            onDragCollection={
              canManageCollections
                ? (collection) =>
                    collectionState.setDraggedItem({
                      type: "collection",
                      id: collection.id,
                    })
                : undefined
            }
            onDragEnd={() => collectionState.setDraggedItem(null)}
            onDrop={(collectionId) =>
              collectionState.dropItem(collectionId, moveServerToCollection)
            }
            onRename={(collection) =>
              collectionState.setCollectionDialog(collection)
            }
            onSelect={(collectionId) => {
              collectionState.setSelectedCollectionId(collectionId);
              setSelected(null);
            }}
            selectedCollectionId={collectionState.selectedCollectionId}
          />
        }
        toolbar={
          <ResourceCollectionSearch
            additionalFilters={
              <label className="checkItem compactCheckItem">
                <input
                  checked={includeArchived}
                  onChange={(event) => setIncludeArchived(event.target.checked)}
                  type="checkbox"
                />
                <span>Arquivados</span>
              </label>
            }
            loading={loading}
            onRefresh={() => loadList()}
            onSearch={() => loadList()}
            onSearchChange={setSearch}
            placeholder="Buscar servidores"
            search={search}
          />
        }
      >
        <div
          className={["catalogLayout", selected ? "catalogDetailSelected" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <ServerSidebar
            canMove={canManageCollections}
            loading={loading}
            onOpen={openServer}
            selectedId={selected?.id}
            onDragEnd={() => collectionState.setDraggedItem(null)}
            onDragStart={(server) =>
              collectionState.setDraggedItem({ type: "item", id: server.id })
            }
            servers={visibleServers}
          />
          <ServerContent
            activeTab={activeTab}
            actor={actor}
            onArchive={archiveSelected}
            onBack={() => setSelected(null)}
            onEdit={setDialog}
            onSelectTab={setActiveTab}
            serverApplications={serverApplications}
            selected={selected}
          />
        </div>
      </ResourceCollectionsShell>
      {collectionState.collectionDialog ? (
        <ResourceCollectionDialog
          collection={
            collectionState.collectionDialog.id
              ? collectionState.collectionDialog
              : null
          }
          onClose={() => collectionState.setCollectionDialog(null)}
          onSave={collectionState.saveCollection}
          parentLabel={collectionPathLabel(
            collectionState.collections,
            collectionState.selectedCollectionId,
          )}
          resourceLabel="servidores"
        />
      ) : null}
      {dialog ? (
        <CatalogEntityDialog
          entity={dialog.id ? dialog : null}
          kind="server"
          onClose={() => setDialog(null)}
          onSave={persist}
        />
      ) : null}
    </section>
  );
}

function ServerHeader({ actor, onCreate, workspace }) {
  return (
    <header className="catalogHero">
      <div>
        <span>{workspace?.name || "Workspace padrão"}</span>
        <h2>Servidores</h2>
        <p>Ativos do workspace e suas referências operacionais.</p>
      </div>
      {hasPermission(actor, "servers.create") && workspace ? (
        <button className="primaryButton" onClick={onCreate} type="button">
          <Plus size={16} /> Novo servidor
        </button>
      ) : null}
    </header>
  );
}

function ServerSidebar({
  canMove,
  loading,
  onOpen,
  onDragEnd,
  onDragStart,
  selectedId,
  servers,
}) {
  return (
    <aside className="catalogSidebar">
      <div className="catalogApplicationList">
        {servers.map((server) => (
          <button
            className={
              selectedId === server.id
                ? "catalogApplicationItem activeCatalogApplication"
                : "catalogApplicationItem"
            }
            key={server.id}
            draggable={canMove}
            onDragEnd={onDragEnd}
            onDragStart={() => onDragStart(server)}
            onClick={() => onOpen(server)}
            type="button"
          >
            <span>
              <Server size={16} />
              {server.name}
            </span>
            <small>{server.hostname || server.key}</small>
            <span className={`catalogStatus catalogStatus-${server.status}`}>
              {server.status}
            </span>
          </button>
        ))}
        {!servers.length && !loading ? (
          <div className="emptyState compactEmpty">
            Nenhum servidor encontrado.
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function ServerContent(props) {
  if (!props.selected)
    return (
      <div className="catalogContent">
        <div className="catalogWelcome">
          <Server size={36} />
          <h3>Selecione um servidor</h3>
          <p>Consulte inventário e aplicações associadas.</p>
        </div>
      </div>
    );
  return <ServerDetails {...props} />;
}

function ServerDetails({
  activeTab,
  actor,
  onArchive,
  onBack,
  onEdit,
  onSelectTab,
  serverApplications,
  selected,
}) {
  const tabs = [
    ["overview", "Visão geral"],
    ...(hasPermission(actor, "applications.read") &&
    hasPermission(actor, "components.read") &&
    hasPermission(actor, "runtimes.read") &&
    hasPermission(actor, "deployments.read")
      ? [["applications", "Aplicações"]]
      : []),
    ["history", "Histórico"],
  ];
  return (
    <div className="catalogContent">
      <header className="catalogDetailHeader">
        <div>
          <span>{selected.key}</span>
          <h2>{selected.name}</h2>
          <p>{selected.description || selected.purpose || "Sem descrição."}</p>
        </div>
        <div className="catalogHeaderActions">
          <button
            className="secondaryButton catalogBackButton"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
          {hasPermission(actor, "servers.update") ? (
            <button
              className="secondaryButton"
              onClick={() => onEdit(selected)}
              type="button"
            >
              <Pencil size={16} /> Editar
            </button>
          ) : null}
          {hasPermission(actor, "servers.archive") &&
          selected.status !== "archived" ? (
            <button className="dangerButton" onClick={onArchive} type="button">
              <Archive size={16} /> Arquivar
            </button>
          ) : null}
        </div>
      </header>
      <div className="detailTabs catalogTabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            aria-selected={activeTab === key}
            className={
              activeTab === key ? "detailTab activeDetailTab" : "detailTab"
            }
            key={key}
            onClick={() => onSelectTab(key)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <ServerTabPanel
        activeTab={activeTab}
        serverApplications={serverApplications}
        selected={selected}
      />
    </div>
  );
}

function ServerTabPanel({ activeTab, selected, serverApplications }) {
  if (activeTab === "overview")
    return (
      <div className="catalogTabPanel">
        <div className="catalogOverviewCard">
          <h3>Inventário</h3>
          <dl>
            <div>
              <dt>Hostname</dt>
              <dd>{selected.hostname || "-"}</dd>
            </div>
            <div>
              <dt>Endereços</dt>
              <dd>{(selected.addresses || []).join(", ") || "-"}</dd>
            </div>
            <div>
              <dt>Provedor</dt>
              <dd>{selected.provider || "-"}</dd>
            </div>
            <div>
              <dt>Localização</dt>
              <dd>{selected.location || "-"}</dd>
            </div>
            <div>
              <dt>Sistema operacional</dt>
              <dd>{selected.operatingSystem || "-"}</dd>
            </div>
            <div>
              <dt>Finalidade</dt>
              <dd>{selected.purpose || "-"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  if (activeTab === "applications")
    return (
      <div className="catalogTabPanel">
        <ServerApplications groups={serverApplications} />
      </div>
    );
  return (
    <div className="catalogTabPanel">
      <AuditHistory
        entityId={selected.id}
        entityType="server"
        refreshKey={selected.updatedAt}
      />
    </div>
  );
}

function ServerApplications({ groups }) {
  return (
    <div className="serverApplicationList">
      {groups.map((application) => (
        <article className="serverApplicationCard" key={application.id}>
          <header>
            <span>Aplicação</span>
            <h3>{application.name}</h3>
          </header>
          <div>
            {application.components.map((component) => (
              <div className="serverApplicationComponent" key={component.id}>
                <strong>{component.name}</strong>
                <small>
                  {component.environments.join(", ") ||
                    "Ambiente não informado"}{" "}
                  · {component.deploymentCount} deployment(s) ·{" "}
                  {component.runtimeCount} runtime(s)
                </small>
              </div>
            ))}
          </div>
        </article>
      ))}
      {!groups.length ? (
        <div className="emptyState catalogEmptyState">
          Nenhuma aplicação utiliza este servidor.
        </div>
      ) : null}
    </div>
  );
}
