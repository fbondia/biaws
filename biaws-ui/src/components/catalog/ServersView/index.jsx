import { Archive, Server } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  archiveServer,
  createServer,
  deleteServer,
  fetchApplications,
  fetchComponents,
  fetchServer,
  fetchServerDeployments,
  fetchServerRuntimes,
  fetchServers,
  fetchWorkspaces,
  moveServerToCollection,
  restoreServer,
  updateServer,
} from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import { useMessages } from "../../../infrastructure/messages/MessagesProvider.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import {
  collectionPathLabel,
  ResourceCollectionSearch,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { buildServerApplicationGroups } from "../serverApplicationModel.js";
import {
  ServerContent,
  ServerDialogs,
  ServerHeader,
  ServerList,
} from "./components/ServerPanels.jsx";

export function ServersView({ actor }) {
  const { confirm } = useMessages();
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
  const listLoadVersionRef = useRef(0);
  const collectionState = useResourceCollections("servers", {
    onError: setError,
    onMoved: () => loadList(),
  });

  async function loadList(nextWorkspace = workspace, filters = {}) {
    if (!nextWorkspace?.id) return;
    const loadVersion = listLoadVersionRef.current + 1;
    listLoadVersionRef.current = loadVersion;
    const payload = await fetchServers(nextWorkspace.id, {
      q: filters.search ?? search,
      includeArchived: filters.includeArchived ?? includeArchived,
      limit: 100,
    });
    if (loadVersion !== listLoadVersionRef.current) return;
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
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        await loadList(workspace, { search, includeArchived });
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [workspace?.id, search, includeArchived]);

  async function persist(payload) {
    const result = dialog?.id
      ? await updateServer(dialog.id, payload)
      : await createServer(workspace.id, payload);
    await loadList();
    if (result.server?.id) await openServer(result.server);
  }

  async function archiveServerItem(server) {
    if (!server || !(await confirm(`Arquivar “${server.name}”?`))) return;
    try {
      await archiveServer(server.id);
      setSelected(null);
      await loadList();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function restoreServerItem(server) {
    if (!(await confirm(`Desarquivar “${server.name}”?`))) return;
    try {
      await restoreServer(server.id);
      setSelected(null);
      await loadList();
    } catch (restoreError) {
      setError(restoreError.message);
    }
  }

  async function deleteServerItem(server) {
    if (
      !(await confirm({
        message: `Excluir definitivamente “${server.name}”? Esta ação não pode ser desfeita.`,
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await deleteServer(server.id);
      setSelected(null);
      await loadList();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const visibleServers = servers.filter(
    ({ collectionId }) =>
      String(collectionId || "") === collectionState.selectedCollectionId,
  );
  const canManageCollections = hasPermission(actor, "servers.update");
  const canManageServerLifecycle = hasPermission(actor, "servers.archive");

  return (
    <section className="catalogPage serversPage">
      <ServerHeader
        actor={actor}
        onCreate={() => setDialog({})}
        workspace={workspace}
      />
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      <ResourceCollectionsShell
        className="serversCollectionsLayout"
        collections={collectionState.collections}
        detailVisible={Boolean(selected)}
        draggedItem={collectionState.draggedItem}
        onDropRoot={() => collectionState.dropItem("", moveServerToCollection)}
        onNavigateBack={() => setSelected(null)}
        onSelectCollection={collectionState.setSelectedCollectionId}
        pathLabel={
          selected
            ? `${collectionPathLabel(
                collectionState.collections,
                selected.collectionId || "",
              )} / ${selected.name}`
            : undefined
        }
        selectedCollectionId={collectionState.selectedCollectionId}
        navigator={
          <ResourceCollectionNavigator
            canDragItem={() => canManageCollections}
            collections={collectionState.collections}
            draggedItem={collectionState.draggedItem}
            itemLabel="servidores"
            items={servers}
            preferenceKey="servers"
            workspaceId={actor.workspaceId}
            onCreate={
              canManageCollections
                ? collectionState.createCollection
                : undefined
            }
            onDelete={collectionState.removeCollection}
            onArchiveItem={
              canManageServerLifecycle
                ? (server) => void archiveServerItem(server)
                : undefined
            }
            onDeleteItem={
              canManageServerLifecycle
                ? (server) => void deleteServerItem(server)
                : undefined
            }
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
            onDragItem={(server) =>
              collectionState.setDraggedItem({ type: "item", id: server.id })
            }
            onDrop={(collectionId) =>
              collectionState.dropItem(collectionId, moveServerToCollection)
            }
            onRename={(collection) =>
              collectionState.setCollectionDialog(collection)
            }
            onRestoreItem={
              canManageServerLifecycle
                ? (server) => void restoreServerItem(server)
                : undefined
            }
            onSelect={(collectionId) => {
              collectionState.setSelectedCollectionId(collectionId);
              setSelected(null);
            }}
            onSelectItem={(server) => {
              collectionState.setSelectedCollectionId(
                server.collectionId || "",
              );
              void openServer(server);
            }}
            renderItem={(server) => (
              <>
                <Server size={13} />
                <span>{server.name}</span>
                {/*<small>{server.hostname || server.key}</small>*/}
              </>
            )}
            selectedCollectionId={collectionState.selectedCollectionId}
            selectedItemId={selected?.id}
          />
        }
        toolbar={
          selected ? null : (
            <ResourceCollectionSearch
              archivedItemsLabel="servidores arquivados"
              includeArchived={includeArchived}
              loading={loading}
              onClearFilters={() => setSearch("")}
              onIncludeArchivedChange={setIncludeArchived}
              onRefresh={() => loadList()}
              onSearch={() => loadList()}
              onSearchChange={setSearch}
              placeholder="Buscar servidores"
              search={search}
            />
          )
        }
      >
        {selected ? (
          <ServerContent
            activeTab={activeTab}
            actor={actor}
            onArchive={() => void archiveServerItem(selected)}
            onBack={() => setSelected(null)}
            onDelete={() => void deleteServerItem(selected)}
            onEdit={setDialog}
            onRestore={() => void restoreServerItem(selected)}
            onSelectTab={setActiveTab}
            serverApplications={serverApplications}
            selected={selected}
          />
        ) : (
          <ServerList
            canDrag={canManageCollections}
            collectionState={collectionState}
            loading={loading}
            onOpen={(server) => void openServer(server)}
            servers={visibleServers}
          />
        )}
      </ResourceCollectionsShell>
      <ServerDialogs
        collectionState={collectionState}
        dialog={dialog}
        onPersist={persist}
        setDialog={setDialog}
      />
    </section>
  );
}
