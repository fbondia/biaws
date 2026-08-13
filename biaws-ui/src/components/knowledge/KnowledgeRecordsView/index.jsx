import { FileText, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { replicateDocument } from "../../../api.js";
import "../../../styles/features/knowledge/index.css";

import { CatalogFilterFields } from "../../catalog/CatalogContextFields/index.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionNavigator,
  ResourceCollectionSearch,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { BulkReplicationToolbar } from "../../shared/BulkReplicationToolbar.jsx";
import { ReplicationDialog } from "../../shared/ReplicationDialog.jsx";
import { replicateItemsInBulk } from "../../shared/replicationModel.js";
import { DocumentDetail } from "./components/DocumentDetail/index.jsx";
import { DocumentTypeFilter } from "./components/DocumentTypeFilter.jsx";
import { DocumentTypeSelection } from "./components/DocumentTypeSelection.jsx";
import { KnowledgeRecordList } from "./components/KnowledgeRecordList.jsx";
import { useKnowledgeRecordsView } from "./hooks/useKnowledgeRecordsView.js";
import { DOCUMENT_TYPES } from "./model.js";

function KnowledgeCollectionDialog({ collectionsState }) {
  if (!collectionsState.collectionDialog) return null;
  async function save(name) {
    await collectionsState.saveCollection(name);
    collectionsState.setCollectionDialog(null);
  }
  return (
    <ResourceCollectionDialog
      collection={collectionsState.collectionDialog}
      onClose={() => collectionsState.setCollectionDialog(null)}
      onSave={save}
      resourceLabel="documentos"
    />
  );
}

export function KnowledgeRecordsView({ actor }) {
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [bulkReplicationOpen, setBulkReplicationOpen] = useState(false);
  const {
    applicationFilter,
    archive,
    catalog,
    closeDetail,
    collectionsState,
    componentFilter,
    continueCreation,
    createType,
    creating,
    draft,
    error,
    includeArchived,
    load,
    loading,
    moveItem,
    openRecord,
    organizationItems,
    permissions,
    persist,
    remove,
    restore,
    saving,
    search,
    searchActive,
    selectCollection,
    selectTypeFilter,
    setApplicationFilter,
    setComponentFilter,
    setCreateType,
    setDraft,
    setIncludeArchived,
    setSearch,
    startCreating,
    taxonomyPackage,
    typeFilter,
    visibleItems,
  } = useKnowledgeRecordsView(actor);
  const visibleRecordIdsKey = visibleItems
    .map(({ id }) => id)
    .sort()
    .join("\u0000");
  const selectedRecords = useMemo(
    () => visibleItems.filter(({ id }) => selectedRecordIds.includes(id)),
    [visibleItems, selectedRecordIds],
  );
  const canReplicate = (actor.workspaces || []).some(
    ({ id, status }) => id !== actor.workspaceId && status !== "archived",
  );

  useEffect(() => {
    const visibleIds = new Set(
      visibleRecordIdsKey ? visibleRecordIdsKey.split("\u0000") : [],
    );
    setSelectedRecordIds((current) => {
      const next = current.filter((recordId) => visibleIds.has(recordId));
      return next.length === current.length ? current : next;
    });
  }, [visibleRecordIdsKey]);

  function toggleRecordSelection(recordId) {
    setSelectedRecordIds((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId],
    );
  }

  function completeBulkReplication() {
    setBulkReplicationOpen(false);
    setSelectedRecordIds([]);
  }

  return (
    <section className="proceduresView contentBand knowledgeRecordsView">
      <div className="proceduresToolbar documentCreateToolbar">
        <div />
        {permissions.create ? (
          <div className="documentCreateActions">
            <button
              className="primaryButton"
              onClick={startCreating}
              type="button"
            >
              <Plus size={16} /> Novo documento
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      <ResourceCollectionsShell
        collections={collectionsState.collections}
        detailVisible={Boolean(draft) || creating}
        draggedItem={collectionsState.draggedItem}
        onDropRoot={() => collectionsState.dropItem("", moveItem)}
        onNavigateBack={closeDetail}
        onSelectCollection={collectionsState.setSelectedCollectionId}
        pathLabel={
          draft
            ? `${collectionPathLabel(collectionsState.collections, draft.collectionId)} / ${draft.title || `Novo ${DOCUMENT_TYPES[draft.documentType].label.toLocaleLowerCase("pt-BR")}`}`
            : creating
              ? `${collectionPathLabel(collectionsState.collections, searchActive ? "" : collectionsState.selectedCollectionId)} / Novo documento`
              : searchActive
                ? "Resultados da busca"
                : undefined
        }
        selectedCollectionId={collectionsState.selectedCollectionId}
        navigator={
          <ResourceCollectionNavigator
            canDragItem={() => permissions.update}
            collections={collectionsState.collections}
            draggedItem={collectionsState.draggedItem}
            itemLabel="documentos"
            items={organizationItems}
            preferenceKey="documents"
            workspaceId={actor.workspaceId}
            onCreate={collectionsState.createCollection}
            onDelete={collectionsState.removeCollection}
            onArchiveItem={permissions.archive ? archive : undefined}
            onDeleteItem={permissions.archive ? remove : undefined}
            onDragCollection={(collection) =>
              collectionsState.setDraggedItem({
                type: "collection",
                id: collection.id,
                parentId: collection.parentId || "",
              })
            }
            onDragEnd={() => collectionsState.setDraggedItem(null)}
            onDragItem={(record) =>
              collectionsState.setDraggedItem({
                type: "record",
                id: record.id,
                collectionId: record.collectionId || "",
              })
            }
            onDrop={(collectionId) =>
              collectionsState.dropItem(collectionId, moveItem)
            }
            onRename={collectionsState.setCollectionDialog}
            onRestoreItem={permissions.archive ? restore : undefined}
            onSelect={selectCollection}
            onSelectItem={openRecord}
            renderItem={(record) => {
              const TypeIcon =
                DOCUMENT_TYPES[record.documentType]?.icon || FileText;
              return (
                <>
                  <TypeIcon size={13} /> <span>{record.title}</span>
                </>
              );
            }}
            selectedCollectionId={collectionsState.selectedCollectionId}
            selectedItemId={draft?.id}
          />
        }
        toolbar={
          draft || creating ? null : (
            <ResourceCollectionSearch
              additionalFilters={
                <div className="knowledgeDocumentFilters">
                  {catalog.applications.length ? (
                    <CatalogFilterFields
                      applicationId={applicationFilter}
                      applications={catalog.applications}
                      componentId={componentFilter}
                      components={catalog.components}
                      onChange={(field, value) => {
                        if (field === "applicationId") {
                          setApplicationFilter(value);
                        }
                        if (field === "componentId") {
                          setComponentFilter(value);
                        }
                      }}
                    />
                  ) : null}
                  <DocumentTypeFilter
                    onChange={selectTypeFilter}
                    value={typeFilter}
                  />
                </div>
              }
              archivedItemsLabel="documentos arquivados"
              className="knowledgeCollectionSearch"
              hasActiveFilters={Boolean(
                search || typeFilter || applicationFilter || componentFilter,
              )}
              includeArchived={includeArchived}
              loading={loading}
              onClearFilters={() => {
                setSearch("");
                selectTypeFilter("");
                setApplicationFilter("");
                setComponentFilter("");
                void load("", "", "", "", includeArchived);
              }}
              onIncludeArchivedChange={setIncludeArchived}
              onRefresh={() => load()}
              onSearch={() => load()}
              onSearchChange={setSearch}
              placeholder="Buscar documentos"
              search={search}
            />
          )
        }
      >
        {creating ? (
          <DocumentTypeSelection
            onContinue={continueCreation}
            onSelect={setCreateType}
            selectedType={createType}
          />
        ) : draft ? (
          <DocumentDetail
            canArchive={permissions.archive}
            canDelete={permissions.archive}
            canRestore={permissions.archive}
            canCreateAttachments={permissions.attachments.create}
            canDeleteAttachments={permissions.attachments.delete}
            canReadAttachments={permissions.attachments.read}
            canUpdate={permissions.update || (!draft.id && permissions.create)}
            canUpdateAttachments={permissions.attachments.update}
            catalog={catalog}
            currentWorkspaceId={actor.workspaceId}
            draft={draft}
            key={draft.id || `new-${draft.documentType}`}
            onArchive={() => archive(draft)}
            onChange={setDraft}
            onDelete={() => remove(draft)}
            onRestore={() => restore(draft)}
            onSave={persist}
            saving={saving}
            taxonomyPackage={taxonomyPackage}
            workspaces={actor.workspaces || []}
          />
        ) : (
          <>
            <BulkReplicationToolbar
              canReplicate={canReplicate}
              count={selectedRecords.length}
              onClear={() => setSelectedRecordIds([])}
              onReplicate={() => setBulkReplicationOpen(true)}
            />
            <KnowledgeRecordList
              canArchive={permissions.archive}
              loading={loading}
              onDelete={remove}
              onOpen={(record) => {
                setSelectedRecordIds([]);
                openRecord(record);
              }}
              onRestore={restore}
              onToggleSelection={toggleRecordSelection}
              records={visibleItems}
              selectedRecordIds={selectedRecordIds}
            />
          </>
        )}
      </ResourceCollectionsShell>
      <KnowledgeCollectionDialog collectionsState={collectionsState} />
      <ReplicationDialog
        currentWorkspaceId={actor.workspaceId}
        description={
          <p>
            Cada documento será criado ou atualizado pelo identificador. O
            contexto, a classificação e o histórico existentes no destino serão
            preservados.
          </p>
        }
        eyebrow={`${selectedRecords.length} ${
          selectedRecords.length === 1
            ? "documento selecionado"
            : "documentos selecionados"
        }`}
        onClose={() => setBulkReplicationOpen(false)}
        onComplete={completeBulkReplication}
        onReplicate={(destinationWorkspaceIds) =>
          replicateItemsInBulk({
            destinationWorkspaceIds,
            getItemLabel: (record) => record.title,
            items: selectedRecords,
            replicateItem: (record, workspaceIds) =>
              replicateDocument(record.id, workspaceIds),
            workspaces: actor.workspaces || [],
          })
        }
        open={bulkReplicationOpen}
        resourceKey={`bulk-documents:${selectedRecords
          .map(({ id }) => id)
          .join("|")}`}
        retryFailed={false}
        title="Replicar documentos"
        workspaces={actor.workspaces || []}
      />
    </section>
  );
}
