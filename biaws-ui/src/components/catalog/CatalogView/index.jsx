import { Layers3, Plus } from "lucide-react";

import { moveApplicationToCollection } from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import { IllustratedEmptyState } from "../../shared/IllustratedEmptyState.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionSearch,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import { CatalogEntityDialog } from "../CatalogEntityDialog.jsx";
import { HeaderActions } from "./components/CatalogComponents.jsx";
import { useCatalogView } from "./hooks/useCatalogView.jsx";
import { CatalogTabContent } from "./tabs/CatalogTabContent.jsx";

function CatalogSelectedDetail({
  activeTab,
  actor,
  context,
  loading,
  onArchive,
  onBack,
  onDelete,
  onEdit,
  onRestore,
  onSelectTab,
  tabProps,
  visibleTabs,
}) {
  if (loading && !context)
    return (
      <div className="catalogCollectionPanel catalogContent">
        <div className="emptyState">Carregando catálogo…</div>
      </div>
    );
  if (!context)
    return (
      <div className="catalogCollectionPanel catalogContent">
        <div className="catalogWelcome">
          <Layers3 size={36} />
          <h3>Selecione uma aplicação</h3>
          <p>Consulte sua topologia, conhecimento relacionado e histórico.</p>
        </div>
      </div>
    );
  return (
    <div className="catalogCollectionPanel catalogContent">
      <header className="catalogDetailHeader">
        <div>
          <span>{context.application.key}</span>
          <h2>{context.application.name}</h2>
          <p>{context.application.description || "Sem descrição."}</p>
        </div>
        <HeaderActions
          actor={actor}
          application={context.application}
          onArchive={onArchive}
          onBack={onBack}
          onDelete={onDelete}
          onEdit={onEdit}
          onRestore={onRestore}
        />
      </header>
      <div
        className="detailTabs catalogTabs"
        role="tablist"
        aria-label="Detalhes da aplicação"
      >
        {visibleTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={
              activeTab === tab.key ? "detailTab activeDetailTab" : "detailTab"
            }
            key={tab.key}
            onClick={() => onSelectTab(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <CatalogTabContent
        activeTab={activeTab}
        actor={actor}
        context={context}
        {...tabProps}
      />
    </div>
  );
}

function CatalogApplicationItems({
  allApplications,
  applications,
  canMove,
  collectionState,
  loading,
  onSelect,
}) {
  return (
    <div className="catalogCollectionItems">
      {applications.map((application) => (
        <button
          className="catalogCollectionItem"
          key={application.id}
          draggable={canMove(application)}
          onDragEnd={() => collectionState.setDraggedItem(null)}
          onDragStart={() =>
            collectionState.setDraggedItem({ type: "item", id: application.id })
          }
          onClick={() => onSelect(application.id)}
          type="button"
        >
          <span className="catalogCollectionItemIcon">
            <Layers3 size={18} />
          </span>
          <span>
            <strong>{application.name}</strong>
            <small>{application.key}</small>
          </span>
        </button>
      ))}
      {!applications.length && !loading ? (
        <IllustratedEmptyState
          description={
            allApplications.length
              ? "Escolha outra coleção ou ajuste os critérios da busca."
              : "Cadastre a primeira aplicação para começar a organizar o catálogo."
          }
          icon={Layers3}
          title="Nenhuma aplicação encontrada"
        />
      ) : null}
    </div>
  );
}

function CatalogDialogs({
  actor,
  collectionState,
  context,
  dialog,
  onPersistApplication,
  onPersistEntity,
  setDialog,
  workspace,
}) {
  return (
    <>
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
          resourceLabel="aplicações"
        />
      ) : null}
      {dialog ? (
        <CatalogEntityDialog
          entity={dialog.entity}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSave={
            dialog.kind === "application"
              ? onPersistApplication
              : onPersistEntity
          }
          options={{
            application: context?.application,
            applications: context?.availableApplications || [],
            canReadDocuments: hasPermission(actor, "documents.read"),
            components: context?.components || [],
            deployments: context?.deployments || [],
            repositories: context?.repositories || [],
            servers: context?.servers || [],
            workspace,
          }}
        />
      ) : null}
    </>
  );
}

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
        setDialog={setDialog}
        workspace={workspace}
      />
    </section>
  );
}
