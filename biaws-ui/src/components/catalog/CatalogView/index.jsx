import { Layers3, Plus } from "lucide-react";

import { moveApplicationToCollection } from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import "../../../styles/features/catalog/index.css";
import {
  collectionPathLabel,
  ResourceCollectionNavigator,
  ResourceCollectionSearch,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import {
  CatalogApplicationItems,
  CatalogDialogs,
  CatalogSelectedDetail,
} from "./components/CatalogViewPanels.jsx";
import { useCatalogView } from "./hooks/useCatalogView.js";

export function CatalogView({ actor }) {
  const {
    workspace,
    applications,
    selectedId,
    setSelectedId,
    context,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    includeArchived,
    setIncludeArchived,
    loading,
    error,
    dialog,
    setDialog,
    visibleTabs,
    persistApplication,
    persistEntity,
    archiveEntity,
    archiveApplicationItem,
    archiveSelectedApplication,
    deleteArchivedApplication,
    editEntity,
    entityActions,
    runtimeByDeployment,
    runtimeLoadingByDeployment,
    runtimeErrorByDeployment,
    loadRuntimes,
    loadApplications,
    restoreArchivedApplication,
    setError,
  } = useCatalogView(actor);
  const collectionState = useResourceCollections("applications", {
    onError: setError,
    onMoved: async () => {
      setSelectedId("");
      await loadApplications();
    },
  });
  const visibleApplications = applications.filter(
    ({ collectionId }) =>
      String(collectionId || "") === collectionState.selectedCollectionId,
  );
  const updateScope = actor.permissionScopes?.["applications.update"] || {};
  const canMoveApplication = (application) =>
    hasPermission(actor, "applications.update") &&
    (updateScope.workspace === true ||
      updateScope.applicationIds?.includes(application.id));
  const canManageCollections = updateScope.workspace === true;
  const canManageApplicationLifecycle = hasPermission(
    actor,
    "applications.archive",
  );
  return (
    <section className="catalogPage">
      <header className="catalogHero">
        <div>
          <span>{workspace?.name || "Workspace padrão"}</span>
          <h2>Catálogo de aplicações</h2>
          <p>
            Produtos, componentes, código e topologia operacional em um único
            contexto.
          </p>
        </div>
        {hasPermission(actor, "applications.create") && workspace ? (
          <button
            className="primaryButton"
            onClick={() => setDialog({ kind: "application", entity: null })}
            type="button"
          >
            <Plus size={16} /> Nova aplicação
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}

      <ResourceCollectionsShell
        className="applicationsCollectionsLayout"
        collections={collectionState.collections}
        detailVisible={Boolean(selectedId)}
        draggedItem={collectionState.draggedItem}
        onDropRoot={() =>
          collectionState.dropItem("", moveApplicationToCollection)
        }
        onNavigateBack={() => setSelectedId("")}
        onSelectCollection={collectionState.setSelectedCollectionId}
        pathLabel={
          context?.application
            ? `${collectionPathLabel(
                collectionState.collections,
                context.application.collectionId || "",
              )} / ${context.application.name}`
            : undefined
        }
        selectedCollectionId={collectionState.selectedCollectionId}
        navigator={
          <ResourceCollectionNavigator
            canDragItem={canMoveApplication}
            collections={collectionState.collections}
            draggedItem={collectionState.draggedItem}
            itemLabel="aplicações"
            items={applications}
            preferenceKey="applications"
            workspaceId={actor.workspaceId}
            onCreate={
              canManageCollections
                ? collectionState.createCollection
                : undefined
            }
            onDelete={collectionState.removeCollection}
            onArchiveItem={
              canManageApplicationLifecycle
                ? (application) => void archiveApplicationItem(application)
                : undefined
            }
            onDeleteItem={
              canManageApplicationLifecycle
                ? (application) => void deleteArchivedApplication(application)
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
            onDragItem={(application) =>
              collectionState.setDraggedItem({
                type: "item",
                id: application.id,
              })
            }
            onDrop={(collectionId) =>
              collectionState.dropItem(
                collectionId,
                moveApplicationToCollection,
              )
            }
            onRename={(collection) =>
              collectionState.setCollectionDialog(collection)
            }
            onRestoreItem={
              canManageApplicationLifecycle
                ? (application) => void restoreArchivedApplication(application)
                : undefined
            }
            onSelect={(collectionId) => {
              collectionState.setSelectedCollectionId(collectionId);
              setSelectedId("");
            }}
            onSelectItem={(application) => {
              collectionState.setSelectedCollectionId(
                application.collectionId || "",
              );
              setSelectedId(application.id);
              setActiveTab("overview");
            }}
            renderItem={(application) => (
              <>
                <Layers3 size={13} />
                <span>{application.name}</span>
                {/*<small>{application.key}</small>*/}
              </>
            )}
            selectedCollectionId={collectionState.selectedCollectionId}
            selectedItemId={selectedId}
          />
        }
        toolbar={
          selectedId ? null : (
            <ResourceCollectionSearch
              archivedItemsLabel="aplicações arquivadas"
              includeArchived={includeArchived}
              loading={loading}
              onClearFilters={() => setSearch("")}
              onIncludeArchivedChange={setIncludeArchived}
              onRefresh={() => loadApplications()}
              onSearch={() => loadApplications()}
              onSearchChange={setSearch}
              placeholder="Buscar aplicações"
              search={search}
            />
          )
        }
      >
        {selectedId ? (
          <CatalogSelectedDetail
            activeTab={activeTab}
            actor={actor}
            context={context}
            loading={loading}
            onArchive={() => void archiveSelectedApplication()}
            onBack={() => setSelectedId("")}
            onDelete={() => void deleteArchivedApplication(context.application)}
            onEdit={() =>
              setDialog({ kind: "application", entity: context.application })
            }
            onRestore={() =>
              void restoreArchivedApplication(context.application)
            }
            onSelectTab={setActiveTab}
            tabProps={{
              editEntity,
              entityActions,
              runtimeByDeployment,
              runtimeErrorByDeployment,
              runtimeLoadingByDeployment,
              loadRuntimes,
              setDialog,
            }}
            visibleTabs={visibleTabs}
          />
        ) : (
          <CatalogApplicationItems
            allApplications={applications}
            applications={visibleApplications}
            canMove={canMoveApplication}
            collectionState={collectionState}
            loading={loading}
            onSelect={(applicationId) => {
              setSelectedId(applicationId);
              setActiveTab("overview");
            }}
          />
        )}
      </ResourceCollectionsShell>

      <CatalogDialogs
        actor={actor}
        collectionState={collectionState}
        context={context}
        dialog={dialog}
        onPersistApplication={persistApplication}
        onPersistEntity={persistEntity}
        onArchiveEntity={archiveEntity}
        setDialog={setDialog}
        workspace={workspace}
      />
    </section>
  );
}
