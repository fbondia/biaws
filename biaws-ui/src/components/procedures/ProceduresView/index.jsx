import {
  BookOpen,
  Eye,
  Filter,
  FilterX,
  Folder,
  FolderTree,
  GripVertical,
  Plus,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { DEFAULT_TAG_GROUP_COLOR } from "../../../constants/issues.js";
import { CatalogFilterFields } from "../../catalog/CatalogContextFields.jsx";
import { FilterDialogButton } from "../../shared/FilterDialogButton.jsx";
import { IllustratedEmptyState } from "../../shared/IllustratedEmptyState.jsx";
import { TaxonomySelector } from "../../taxonomy/TaxonomySelector.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionSearch,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import {
  ProcedureClassificationSummary,
  ProcedureDialog,
} from "./components/ProcedureDialog.jsx";
import { useProceduresView } from "./hooks/useProceduresView.js";
import { normalizeDraft } from "./model.js";

export function ProceduresView({ actor }) {
  const {
    organizationItems,
    collections,
    search,
    setSearch,
    taxonomyFilters,
    setTaxonomyFilters,
    tagFilters,
    selectedCollectionId,
    setSelectedCollectionId,
    searchActive,
    filtersVisible,
    setFiltersVisible,
    renamingCollection,
    setRenamingCollection,
    tagsDialogOpen,
    setTagsDialogOpen,
    taxonomyDialogOpen,
    setTaxonomyDialogOpen,
    draggedItem,
    setDraggedItem,
    draft,
    setDraft,
    taxonomyPackage,
    loading,
    saving,
    error,
    applicationFilter,
    setApplicationFilter,
    componentFilter,
    setComponentFilter,
    catalog,
    selectedTagCount,
    load,
    persist,
    applyPersistedProcedure,
    remove,
    clearFilters,
    toggleFilterTag,
    createCollection,
    renameCollection,
    removeCollection,
    moveDraggedItem,
    visibleItems,
  } = useProceduresView(actor);

  return (
    <section className="proceduresView contentBand">
      <div className="proceduresToolbar">
        <button
          aria-controls="procedure-filters"
          aria-expanded={filtersVisible}
          className={
            filtersVisible
              ? "secondaryButton activeFiltersButton"
              : "secondaryButton"
          }
          onClick={() => setFiltersVisible((current) => !current)}
          type="button"
        >
          {filtersVisible ? <FilterX size={16} /> : <Filter size={16} />}
          {filtersVisible ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
        <div className="procedureToolbarActions">
          <button
            className="primaryButton"
            onClick={() =>
              setDraft(
                normalizeDraft({
                  collectionId: searchActive ? "" : selectedCollectionId,
                }),
              )
            }
            type="button"
          >
            <Plus size={16} /> Novo procedimento
          </button>
        </div>
      </div>

      <ProcedureFilters
        applicationFilter={applicationFilter}
        catalog={catalog}
        clearFilters={clearFilters}
        componentFilter={componentFilter}
        filtersVisible={filtersVisible}
        load={load}
        search={search}
        selectedTagCount={selectedTagCount}
        setApplicationFilter={setApplicationFilter}
        setComponentFilter={setComponentFilter}
        setTagsDialogOpen={setTagsDialogOpen}
        setTaxonomyDialogOpen={setTaxonomyDialogOpen}
        taxonomyFilters={taxonomyFilters}
        taxonomyPackage={taxonomyPackage}
      />

      <ProcedureError error={error} />

      <ResourceCollectionsShell
        collections={collections}
        detailVisible={Boolean(draft?.id)}
        draggedItem={draggedItem}
        onDropRoot={() => moveDraggedItem("")}
        onNavigateBack={() => setDraft(null)}
        onSelectCollection={setSelectedCollectionId}
        pathLabel={
          draft?.id
            ? `${collectionPathLabel(
                collections,
                draft.collectionId || "",
              )} / ${draft.title}`
            : searchActive
              ? "Resultados da busca"
              : undefined
        }
        selectedCollectionId={selectedCollectionId}
        navigator={
          <ResourceCollectionNavigator
            canDragItem={() => true}
            collections={collections}
            draggedItem={draggedItem}
            itemLabel="procedimentos"
            items={organizationItems}
            onCreate={createCollection}
            onDelete={removeCollection}
            onDeleteItem={remove}
            onDragCollection={(collection) =>
              setDraggedItem({
                type: "collection",
                id: collection.id,
                parentId: collection.parentId || "",
              })
            }
            onDragEnd={() => setDraggedItem(null)}
            onDragItem={(procedure) =>
              setDraggedItem({
                type: "procedure",
                id: procedure.id,
                collectionId: procedure.collectionId || "",
              })
            }
            onDrop={moveDraggedItem}
            onRename={setRenamingCollection}
            onSelect={(collectionId) => {
              setDraft(null);
              setSelectedCollectionId(collectionId);
            }}
            onSelectItem={(procedure) => {
              clearFilters();
              setDraft(normalizeDraft(procedure));
              setSelectedCollectionId(procedure.collectionId || "");
            }}
            renderItem={(procedure) => (
              <>
                <BookOpen size={13} />
                <span>{procedure.title}</span>
              </>
            )}
            selectedCollectionId={selectedCollectionId}
            selectedItemId={draft?.id}
          />
        }
        toolbar={
          draft?.id ? null : (
            <ResourceCollectionSearch
              loading={loading}
              onRefresh={() => load()}
              onSearch={() => load()}
              onSearchChange={setSearch}
              placeholder="Buscar procedimentos"
              search={search}
            />
          )
        }
      >
        {draft?.id ? (
          <ProcedureDialog
            applications={catalog.applications}
            components={catalog.components}
            draft={draft}
            embedded
            onChange={setDraft}
            onClose={() => setDraft(null)}
            onDelete={() => remove(draft)}
            onPersistedChange={applyPersistedProcedure}
            onSave={persist}
            saving={saving}
            taxonomyPackage={taxonomyPackage}
          />
        ) : (
          <section className="resourceCollectionContent">
            {loading ? (
              <div className="loadingLine">Carregando procedimentos...</div>
            ) : null}
            {!loading && !visibleItems.length ? (
              <IllustratedEmptyState
                description={
                  searchActive
                    ? "Tente ajustar a busca ou os filtros aplicados."
                    : "Crie o primeiro procedimento para documentar e padronizar a operação."
                }
                icon={BookOpen}
                title={
                  searchActive
                    ? "Nenhum procedimento encontrado"
                    : "Nenhum procedimento nesta coleção"
                }
              />
            ) : null}
            <div className="procedureCards">
              {visibleItems.map((procedure) => (
                <article
                  className={["procedureCard", "draggableProcedureCard"]
                    .filter(Boolean)
                    .join(" ")}
                  data-collection-browser-item-id={procedure.id}
                  draggable
                  key={procedure.id}
                  onDragEnd={() => setDraggedItem(null)}
                  onDragStart={(event) => {
                    if (event.target.closest("button")) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "text/plain",
                      `procedure:${procedure.id}`,
                    );
                    setDraggedItem({
                      type: "procedure",
                      id: procedure.id,
                      collectionId: procedure.collectionId || "",
                    });
                  }}
                >
                  <header>
                    <div>
                      <GripVertical
                        aria-hidden="true"
                        className="procedureCardDragHandle"
                        size={15}
                      />
                      <BookOpen size={18} />
                      <h2>{procedure.title}</h2>
                    </div>
                    <div>
                      <button
                        className="iconButton"
                        onClick={() => setDraft(normalizeDraft(procedure))}
                        title="Visualizar"
                        type="button"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="iconButton dangerIconButton"
                        onClick={() => remove(procedure)}
                        title="Excluir"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </header>
                  {searchActive ? (
                    <div className="procedureCollectionLocation">
                      <Folder size={14} />
                      {collectionPathLabel(collections, procedure.collectionId)}
                    </div>
                  ) : null}
                  <ProcedureClassificationSummary
                    procedure={procedure}
                    taxonomyPackage={taxonomyPackage}
                  />
                  <p
                    className={
                      procedure.summary
                        ? "procedureCardSummary"
                        : "procedureCardSummary emptyProcedureSummary"
                    }
                  >
                    {procedure.summary || "Sumário não informado"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </ResourceCollectionsShell>
      <ProcedureDialogs
        applyPersistedProcedure={applyPersistedProcedure}
        catalog={catalog}
        collections={collections}
        draft={draft}
        persist={persist}
        renameCollection={renameCollection}
        renamingCollection={renamingCollection}
        saving={saving}
        selectedTagCount={selectedTagCount}
        setDraft={setDraft}
        setRenamingCollection={setRenamingCollection}
        setTagsDialogOpen={setTagsDialogOpen}
        setTaxonomyDialogOpen={setTaxonomyDialogOpen}
        setTaxonomyFilters={setTaxonomyFilters}
        tagFilters={tagFilters}
        tagsDialogOpen={tagsDialogOpen}
        taxonomyDialogOpen={taxonomyDialogOpen}
        taxonomyFilters={taxonomyFilters}
        taxonomyPackage={taxonomyPackage}
        toggleFilterTag={toggleFilterTag}
      />
    </section>
  );
}

function ProcedureError({ error }) {
  if (!error) return null;
  return <div className="errorBox">{error}</div>;
}

function ProcedureFilters({
  applicationFilter,
  catalog,
  clearFilters,
  componentFilter,
  filtersVisible,
  load,
  search,
  selectedTagCount,
  setApplicationFilter,
  setComponentFilter,
  setTagsDialogOpen,
  setTaxonomyDialogOpen,
  taxonomyFilters,
  taxonomyPackage,
}) {
  if (!filtersVisible) return null;
  function changeCatalogFilter(field, value) {
    if (field === "applicationId") setApplicationFilter(value);
    if (field === "componentId") setComponentFilter(value);
  }
  const hasFilters =
    search ||
    taxonomyFilters.length ||
    selectedTagCount ||
    applicationFilter ||
    componentFilter;
  return (
    <div className="procedureFiltersBox" id="procedure-filters">
      <form
        className="procedureFiltersForm"
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
      >
        {catalog.applications.length ? (
          <CatalogFilterFields
            applicationId={applicationFilter}
            applications={catalog.applications}
            componentId={componentFilter}
            components={catalog.components}
            onChange={changeCatalogFilter}
          />
        ) : null}
        {taxonomyPackage?.tagGroups?.length ? (
          <FilterDialogButton
            count={selectedTagCount}
            icon={Tags}
            label="Tags"
            onClick={() => setTagsDialogOpen(true)}
            summary={
              selectedTagCount
                ? `${selectedTagCount} selecionada(s)`
                : "Todas as tags"
            }
          />
        ) : null}
        {taxonomyPackage?.taxonomy?.length ? (
          <FilterDialogButton
            count={taxonomyFilters.length}
            icon={FolderTree}
            label="Classificações"
            onClick={() => setTaxonomyDialogOpen(true)}
            summary={
              taxonomyFilters.length
                ? `${taxonomyFilters.length} selecionada(s)`
                : "Todas as classificações"
            }
          />
        ) : null}

        <div className="procedureFilterActions">
          {search ||
          taxonomyFilters.length ||
          selectedTagCount ||
          applicationFilter ||
          componentFilter ? (
            <button
              className="secondaryButton"
              onClick={clearFilters}
              type="button"
            >
              <X size={16} /> Limpar
            </button>
          ) : null}
          <button className="primaryButton" type="submit">
            <Search size={16} /> Buscar
          </button>
        </div>
      </form>
    </div>
  );
}

function ProcedureDialogs(props) {
  return (
    <>
      <ProcedureTagDialog {...props} />
      <ProcedureTaxonomyDialog {...props} />
      <ProcedureEntityDialogs {...props} />
    </>
  );
}

function ProcedureTagDialog({
  selectedTagCount,
  setTagsDialogOpen,
  tagFilters,
  tagsDialogOpen,
  taxonomyPackage,
  toggleFilterTag,
}) {
  if (!tagsDialogOpen) return null;
  function clearTagSelection() {
    Object.entries(tagFilters).forEach(([groupId, tagIds]) => {
      tagIds.forEach((tagId) => toggleFilterTag(groupId, tagId));
    });
  }
  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && setTagsDialogOpen(false)
      }
    >
      <section
        aria-label="Filtrar por tags"
        aria-modal="true"
        className="tagFilterDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Filtrar por tags</strong>
            <span>Selecione uma ou mais tags.</span>
          </div>
          {selectedTagCount ? (
            <small>{selectedTagCount} selecionada(s)</small>
          ) : null}
        </header>
        <div className="tagFilterGroups">
          {(taxonomyPackage?.tagGroups || []).map((group) => (
            <div className="tagFilterGroup" key={group.id}>
              <strong>
                <span
                  className="tagColorSwatch"
                  style={{
                    backgroundColor: group.color || DEFAULT_TAG_GROUP_COLOR,
                  }}
                />
                {group.label}
              </strong>
              <div className="tagFilterOptions">
                {(group.tags || []).map((tagId) => {
                  const checked = (tagFilters[group.id] || []).includes(tagId);
                  return (
                    <label
                      className={
                        checked
                          ? "tagFilterOption selectedTagFilterOption"
                          : "tagFilterOption"
                      }
                      key={tagId}
                      style={{
                        borderColor: checked
                          ? group.color || DEFAULT_TAG_GROUP_COLOR
                          : undefined,
                      }}
                    >
                      <input
                        checked={checked}
                        onChange={() => toggleFilterTag(group.id, tagId)}
                        type="checkbox"
                      />
                      <span>{tagId}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <footer>
          {selectedTagCount ? (
            <button
              className="secondaryButton clearDialogSelectionButton"
              onClick={clearTagSelection}
              type="button"
            >
              Limpar seleção
            </button>
          ) : null}
          <button
            className="primaryButton"
            data-dialog-close
            onClick={() => setTagsDialogOpen(false)}
            type="button"
          >
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
}

function ProcedureTaxonomyDialog({
  setTaxonomyDialogOpen,
  setTaxonomyFilters,
  taxonomyDialogOpen,
  taxonomyFilters,
  taxonomyPackage,
}) {
  if (!taxonomyDialogOpen) return null;
  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && setTaxonomyDialogOpen(false)
      }
    >
      <section
        aria-label="Filtrar por classificações"
        aria-modal="true"
        className="tagFilterDialog taxonomyFilterDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Filtrar por classificações</strong>
            <span>Selecione uma ou mais classificações da árvore.</span>
          </div>
          {taxonomyFilters.length ? (
            <small>{taxonomyFilters.length} selecionada(s)</small>
          ) : null}
        </header>
        <div className="taxonomyFilterDialogContent">
          <TaxonomySelector
            multiple
            nodes={taxonomyPackage?.taxonomy || []}
            onChange={setTaxonomyFilters}
            value={taxonomyFilters}
          />
        </div>
        <footer>
          {taxonomyFilters.length ? (
            <button
              className="secondaryButton clearDialogSelectionButton"
              onClick={() => setTaxonomyFilters([])}
              type="button"
            >
              Limpar seleção
            </button>
          ) : null}
          <button
            className="primaryButton"
            data-dialog-close
            onClick={() => setTaxonomyDialogOpen(false)}
            type="button"
          >
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
}

function ProcedureEntityDialogs({
  applyPersistedProcedure,
  catalog,
  collections,
  draft,
  persist,
  renameCollection,
  renamingCollection,
  saving,
  setDraft,
  setRenamingCollection,
  taxonomyPackage,
}) {
  return (
    <>
      {renamingCollection ? (
        <ResourceCollectionDialog
          collection={renamingCollection}
          onClose={() => setRenamingCollection(null)}
          onSave={renameCollection}
          parentLabel={collectionPathLabel(
            collections,
            renamingCollection.parentId,
          )}
        />
      ) : null}
      {draft && !draft.id ? (
        <ProcedureDialog
          applications={catalog.applications}
          components={catalog.components}
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onPersistedChange={applyPersistedProcedure}
          onSave={persist}
          saving={saving}
          taxonomyPackage={taxonomyPackage}
        />
      ) : null}
    </>
  );
}
