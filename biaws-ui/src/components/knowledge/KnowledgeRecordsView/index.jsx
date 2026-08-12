import { FileText, Plus } from "lucide-react";

import { CatalogFilterFields } from "../../catalog/CatalogContextFields.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionNavigator,
  ResourceCollectionSearch,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { DocumentDetail } from "./components/DocumentDetail/index.jsx";
import { DocumentTypeSelection } from "./components/DocumentTypeSelection.jsx";
import { KnowledgeRecordList } from "./components/KnowledgeRecordList.jsx";
import { useKnowledgeRecordsView } from "./hooks/useKnowledgeRecordsView.js";
import { DOCUMENT_TYPES, TYPE_FILTERS } from "./model.js";

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
    load,
    loading,
    moveItem,
    openRecord,
    organizationItems,
    permissions,
    persist,
    saving,
    search,
    searchActive,
    selectCollection,
    selectTypeFilter,
    setApplicationFilter,
    setComponentFilter,
    setCreateType,
    setDraft,
    setSearch,
    startCreating,
    taxonomyPackage,
    typeFilter,
    visibleItems,
  } = useKnowledgeRecordsView(actor);

  return (
    <section className="proceduresView contentBand knowledgeRecordsView">
      <div aria-label="Tipo de documento" className="documentTypeSelector">
        {TYPE_FILTERS.map(([value, label, Icon]) => (
          <button
            aria-pressed={typeFilter === value}
            className={
              typeFilter === value
                ? "documentTypeOption active"
                : "documentTypeOption"
            }
            key={value || "all"}
            onClick={() => selectTypeFilter(value)}
            type="button"
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
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
      <div className="procedureFiltersBox">
        <div className="procedureFiltersForm">
          {catalog.applications.length ? (
            <CatalogFilterFields
              applicationId={applicationFilter}
              applications={catalog.applications}
              componentId={componentFilter}
              components={catalog.components}
              onChange={(field, value) => {
                if (field === "applicationId") setApplicationFilter(value);
                if (field === "componentId") setComponentFilter(value);
              }}
            />
          ) : null}
          <button
            className="secondaryButton"
            onClick={() => load()}
            type="button"
          >
            Filtrar
          </button>
        </div>
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
            onCreate={collectionsState.createCollection}
            onDelete={collectionsState.removeCollection}
            onDeleteItem={permissions.archive ? archive : undefined}
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
              loading={loading}
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
            canCreateAttachments={permissions.attachments.create}
            canDeleteAttachments={permissions.attachments.delete}
            canReadAttachments={permissions.attachments.read}
            canUpdate={permissions.update || (!draft.id && permissions.create)}
            canUpdateAttachments={permissions.attachments.update}
            catalog={catalog}
            draft={draft}
            key={draft.id || `new-${draft.documentType}`}
            onArchive={() => archive(draft)}
            onChange={setDraft}
            onSave={persist}
            saving={saving}
            taxonomyPackage={taxonomyPackage}
          />
        ) : (
          <KnowledgeRecordList
            canArchive={permissions.archive}
            loading={loading}
            onArchive={archive}
            onOpen={openRecord}
            records={visibleItems}
          />
        )}
      </ResourceCollectionsShell>
      <KnowledgeCollectionDialog collectionsState={collectionsState} />
    </section>
  );
}
