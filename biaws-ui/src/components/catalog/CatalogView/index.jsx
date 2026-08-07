import { Layers3, Plus } from "lucide-react";

import { moveApplicationToCollection } from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionSearch,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import { CatalogEntityDialog } from "../CatalogEntityDialog.jsx";
import { HeaderActions } from "./components/CatalogComponents.jsx";
import { useCatalogView } from "./hooks/useCatalogView.jsx";
import { CatalogTabContent } from "./tabs/CatalogTabContent.jsx";

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
    archiveSelectedApplication,
    editEntity,
    entityActions,
    runtimeByDeployment,
    runtimeLoadingByDeployment,
    runtimeErrorByDeployment,
    loadRuntimes,
    loadApplications,
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

      {error ? <div className="errorBox">{error}</div> : null}

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
            onCreate={
              canManageCollections
                ? collectionState.createCollection
                : undefined
            }
            onDelete={collectionState.removeCollection}
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
                <small>{application.key}</small>
              </>
            )}
            selectedCollectionId={collectionState.selectedCollectionId}
            selectedItemId={selectedId}
          />
        }
        toolbar={
          selectedId ? null : (
            <ResourceCollectionSearch
              additionalFilters={
                <label className="checkItem compactCheckItem">
                  <input
                    checked={includeArchived}
                    onChange={(event) =>
                      setIncludeArchived(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Arquivadas</span>
                </label>
              }
              loading={loading}
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
          <div className="catalogCollectionPanel catalogContent">
            {loading && !context ? (
              <div className="emptyState">Carregando catálogo…</div>
            ) : null}
            {!loading && !context ? (
              <div className="catalogWelcome">
                <Layers3 size={36} />
                <h3>Selecione uma aplicação</h3>
                <p>
                  Consulte sua topologia, conhecimento relacionado e histórico.
                </p>
              </div>
            ) : null}
            {context ? (
              <>
                <header className="catalogDetailHeader">
                  <div>
                    <span>{context.application.key}</span>
                    <h2>{context.application.name}</h2>
                    <p>{context.application.description || "Sem descrição."}</p>
                  </div>
                  <HeaderActions
                    actor={actor}
                    application={context.application}
                    onArchive={() => void archiveSelectedApplication()}
                    onBack={() => setSelectedId("")}
                    onEdit={() =>
                      setDialog({
                        kind: "application",
                        entity: context.application,
                      })
                    }
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
                        activeTab === tab.key
                          ? "detailTab activeDetailTab"
                          : "detailTab"
                      }
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
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
                  editEntity={editEntity}
                  entityActions={entityActions}
                  runtimeByDeployment={runtimeByDeployment}
                  runtimeErrorByDeployment={runtimeErrorByDeployment}
                  runtimeLoadingByDeployment={runtimeLoadingByDeployment}
                  loadRuntimes={loadRuntimes}
                  setDialog={setDialog}
                />
              </>
            ) : null}
          </div>
        ) : (
          <div className="catalogCollectionItems">
            {visibleApplications.map((application) => (
              <button
                className="catalogCollectionItem"
                key={application.id}
                draggable={canMoveApplication(application)}
                onDragEnd={() => collectionState.setDraggedItem(null)}
                onDragStart={() =>
                  collectionState.setDraggedItem({
                    type: "item",
                    id: application.id,
                  })
                }
                onClick={() => {
                  setSelectedId(application.id);
                  setActiveTab("overview");
                }}
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
            {!visibleApplications.length && !loading ? (
              <div className="emptyState compactEmpty">
                Nenhuma aplicação encontrada.
              </div>
            ) : null}
          </div>
        )}
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
          resourceLabel="aplicações"
        />
      ) : null}

      {dialog ? (
        <CatalogEntityDialog
          entity={dialog.entity}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSave={
            dialog.kind === "application" ? persistApplication : persistEntity
          }
          options={{
            application: context?.application,
            applications: context?.availableApplications || [],
            canReadProcedures: hasPermission(actor, "procedures.read"),
            components: context?.components || [],
            deployments: context?.deployments || [],
            repositories: context?.repositories || [],
            servers: context?.servers || [],
            workspace,
          }}
        />
      ) : null}
    </section>
  );
}
