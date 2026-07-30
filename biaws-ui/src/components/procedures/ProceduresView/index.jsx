import {
  BookOpen,
  Eye,
  Filter,
  FilterX,
  Folder,
  FolderPlus,
  FolderTree,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";

import { DEFAULT_TAG_GROUP_COLOR } from "../../../constants/issues.js";
import { CatalogFilterFields } from "../../catalog/CatalogContextFields.jsx";
import { FilterDialogButton } from "../../shared/FilterDialogButton.jsx";
import { TaxonomySelector } from "../../taxonomy/TaxonomySelector.jsx";
import {
  collectionPathLabel,
  ProcedureCollectionDialog,
  ProcedureCollectionSidebar,
} from "../ProcedureCollections.jsx";
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
    collectionDialogOpen,
    setCollectionDialogOpen,
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
    selectedCollection,
    selectedCollectionLabel,
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
            className="secondaryButton"
            onClick={() => setCollectionDialogOpen(true)}
            type="button"
          >
            <FolderPlus size={16} /> Nova coleção
          </button>
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
        setSearch={setSearch}
        setTagsDialogOpen={setTagsDialogOpen}
        setTaxonomyDialogOpen={setTaxonomyDialogOpen}
        taxonomyFilters={taxonomyFilters}
        taxonomyPackage={taxonomyPackage}
      />

      <ProcedureError error={error} />

      <div className="procedureWorkspace">
        <ProcedureCollectionSidebar
          collections={collections}
          draggedItem={draggedItem}
          items={organizationItems}
          onDragCollection={(collection) =>
            setDraggedItem({
              type: "collection",
              id: collection.id,
              parentId: collection.parentId || "",
            })
          }
          onDragEnd={() => setDraggedItem(null)}
          onDelete={removeCollection}
          onDrop={moveDraggedItem}
          onSelect={setSelectedCollectionId}
          selectedCollectionId={selectedCollectionId}
        />

        <section className="procedureCollectionContent">
          <header className="procedureCollectionContentHeader">
            <div>
              <span>
                {searchActive ? "Busca em todas as coleções" : "Local atual"}
              </span>
              <div className="procedureCollectionTitleRow">
                <h2>
                  {searchActive
                    ? "Resultados da busca"
                    : selectedCollectionLabel}
                </h2>
                {!searchActive && selectedCollection ? (
                  <button
                    className="secondaryButton procedureCollectionRenameButton"
                    onClick={() => setRenamingCollection(selectedCollection)}
                    type="button"
                  >
                    <Pencil size={14} /> Renomear
                  </button>
                ) : null}
              </div>
              {searchActive ? (
                <p>
                  A organização por coleções não restringe os resultados
                  encontrados.
                </p>
              ) : selectedCollection ? (
                <p>
                  Exibindo apenas os procedimentos diretamente nesta coleção.
                </p>
              ) : (
                <p>Procedimentos que não pertencem a uma coleção.</p>
              )}
            </div>
          </header>

          {loading ? (
            <div className="loadingLine">Carregando procedimentos...</div>
          ) : null}
          {!loading && !visibleItems.length ? (
            <div className="emptyState">
              {searchActive
                ? "Nenhum procedimento encontrado."
                : "Nenhum procedimento nesta coleção."}
            </div>
          ) : null}
          <div className="procedureCards">
            {visibleItems.map((procedure) => (
              <article
                className="procedureCard draggableProcedureCard"
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
      </div>
      <ProcedureDialogs
        applyPersistedProcedure={applyPersistedProcedure}
        catalog={catalog}
        collectionDialogOpen={collectionDialogOpen}
        collections={collections}
        createCollection={createCollection}
        draft={draft}
        persist={persist}
        renameCollection={renameCollection}
        renamingCollection={renamingCollection}
        saving={saving}
        selectedCollectionLabel={selectedCollectionLabel}
        selectedTagCount={selectedTagCount}
        setCollectionDialogOpen={setCollectionDialogOpen}
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
  setSearch,
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
  function submit(event) {
    event.preventDefault();
    load();
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
        <label className="procedureSearchInput">
          <Search size={17} />
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar em título, sumário ou conteúdo"
            value={search}
          />
        </label>

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
  collectionDialogOpen,
  collections,
  createCollection,
  draft,
  persist,
  renameCollection,
  renamingCollection,
  saving,
  selectedCollectionLabel,
  setCollectionDialogOpen,
  setDraft,
  setRenamingCollection,
  taxonomyPackage,
}) {
  return (
    <>
      {collectionDialogOpen ? (
        <ProcedureCollectionDialog
          onClose={() => setCollectionDialogOpen(false)}
          onSave={createCollection}
          parentLabel={selectedCollectionLabel}
        />
      ) : null}
      {renamingCollection ? (
        <ProcedureCollectionDialog
          collection={renamingCollection}
          onClose={() => setRenamingCollection(null)}
          onSave={renameCollection}
          parentLabel={collectionPathLabel(
            collections,
            renamingCollection.parentId,
          )}
        />
      ) : null}
      {draft ? (
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
