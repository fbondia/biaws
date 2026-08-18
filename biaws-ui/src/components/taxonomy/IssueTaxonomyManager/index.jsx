import {
  Download,
  FolderTree,
  Plus,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";

import "../../../styles/features/taxonomy.css";

import { DEFAULT_TAG_GROUP_COLOR } from "../../../constants/issues.js";
import { useFileDrop } from "../../shared/useFileDrop.js";
import { TaxonomySelector } from "../TaxonomySelector/index.jsx";
import { useIssueTaxonomyManager } from "./hooks/useIssueTaxonomyManager.js";
import { slugify } from "./model.js";

export function IssueTaxonomyManager() {
  const {
    uploadInputRef,
    catalog,
    applications,
    selectedGroupId,
    setSelectedGroupId,
    selectedNodeId,
    setSelectedNodeId,
    activeDefinitionTab,
    setActiveDefinitionTab,
    newTag,
    setNewTag,
    addingTag,
    loading,
    saving,
    message,
    error,
    selectedGroup,
    hasPendingChanges,
    loadTaxonomy,
    updateSelectedGroup,
    addTag,
    openAddTagDialog,
    closeAddTagDialog,
    removeTag,
    addNode,
    editNode,
    deleteNode,
    loadTaxonomyFile,
    uploadTaxonomyFile,
    openUploadDialog,
    downloadTaxonomyFile,
    saveCatalog,
  } = useIssueTaxonomyManager();
  const { isDraggingFiles, dropTargetProps } = useFileDrop({
    disabled: loading || saving,
    onDropFiles: (files) => loadTaxonomyFile(files[0]),
  });
  return (
    <section className="taxonomyPage">
      <div className="taxonomyHero">
        <div>
          <span>Administração</span>
          <h2>Taxonomia de Chamados e Documentação</h2>
          <p>
            Estruture categorias, grupos e marcadores para organizar chamados e
            documentos.
          </p>
        </div>
        <div className="taxonomyHeroActions">
          <button
            className="secondaryButton"
            disabled={loading || saving}
            type="button"
            onClick={loadTaxonomy}
          >
            <RefreshCw size={16} />
            Recarregar
          </button>
          <button
            {...dropTargetProps}
            className={`secondaryButton${isDraggingFiles ? " fileDropTargetActive" : ""}`}
            disabled={loading || saving}
            type="button"
            onClick={openUploadDialog}
          >
            <Upload size={16} />
            {isDraggingFiles ? "Solte o JSON" : "Enviar ou arrastar JSON"}
          </button>
          <input
            accept="application/json,.json"
            className="hiddenFileInput"
            onChange={uploadTaxonomyFile}
            ref={uploadInputRef}
            type="file"
          />
          <button
            className="secondaryButton"
            disabled={loading || saving}
            type="button"
            onClick={downloadTaxonomyFile}
          >
            <Download size={16} />
            Baixar JSON
          </button>
          <button
            className="primaryButton"
            disabled={loading || saving || !hasPendingChanges}
            type="button"
            onClick={saveCatalog}
          >
            <Save size={16} />
            {saving ? "Gravando..." : "Gravar alterações"}
          </button>
        </div>
      </div>

      {message ? <div className="infoBox">{message}</div> : null}
      {error ? <div className="errorBox taxonomyError">{error}</div> : null}
      {hasPendingChanges ? (
        <div className="warningBox">
          Há alterações no rascunho que ainda não foram gravadas.
        </div>
      ) : null}

      {/*
      <div className="taxonomyMetrics">
        <div className="metric">
          <Tag size={18} />
          <div>
            <span>Grupos</span>
            <strong>{catalog.tagGroups.length}</strong>
          </div>
        </div>
        <div className="metric">
          <FolderTree size={18} />
          <div>
            <span>Nós da árvore</span>
            <strong>{countNodes(catalog.taxonomy)}</strong>
          </div>
        </div>
        <div className="metric">
          <Copy size={18} />
          <div>
            <span>Tags de grupo</span>
            <strong>{groupTagCount(catalog.tagGroups)}</strong>
          </div>
        </div>
      </div>
      */}

      <div
        className="detailTabs taxonomyDefinitionTabs"
        role="tablist"
        aria-label="Definições da taxonomia"
      >
        <button
          aria-selected={activeDefinitionTab === "classification"}
          className={
            activeDefinitionTab === "classification"
              ? "detailTab activeDetailTab"
              : "detailTab"
          }
          onClick={() => setActiveDefinitionTab("classification")}
          role="tab"
          type="button"
        >
          <FolderTree size={16} />
          Classificação
        </button>
        <button
          aria-selected={activeDefinitionTab === "tags"}
          className={
            activeDefinitionTab === "tags"
              ? "detailTab activeDetailTab"
              : "detailTab"
          }
          onClick={() => setActiveDefinitionTab("tags")}
          role="tab"
          type="button"
        >
          <Tag size={16} />
          Grupos de tags
        </button>
      </div>

      {activeDefinitionTab === "classification" ? (
        <section className="taxonomyPanel taxonomyTabPanel" role="tabpanel">
          <header className="panelHeader">
            <div>
              <h3>Árvore de classificação</h3>
              <span>
                Hierarquia principal usada para organizar assuntos de issues.
              </span>
            </div>
          </header>

          <TaxonomySelector
            activeValue={selectedNodeId}
            applications={applications}
            nodes={catalog.taxonomy}
            onActiveChange={setSelectedNodeId}
            onAddNode={addNode}
            onDeleteNode={deleteNode}
            onEditNode={editNode}
            selectable={false}
          />
        </section>
      ) : null}

      {activeDefinitionTab === "tags" ? (
        <section className="taxonomyPanel taxonomyTabPanel" role="tabpanel">
          <header className="panelHeader">
            <div>
              <h3>Grupos de tags</h3>
              <span>
                Selecione um grupo para editar seus dados e as tags associadas.
              </span>
            </div>
          </header>

          <div className="tagGroupsWorkspace">
            <nav className="tagGroupNavigation" aria-label="Grupos de tags">
              {catalog.tagGroups.map((group) => (
                <button
                  aria-current={
                    group.id === selectedGroupId ? "true" : undefined
                  }
                  className={
                    group.id === selectedGroupId
                      ? "activeTagGroupNavigationItem"
                      : ""
                  }
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  type="button"
                >
                  <span
                    className="tagColorSwatch"
                    style={{
                      backgroundColor: group.color || DEFAULT_TAG_GROUP_COLOR,
                    }}
                  />
                  <span>
                    <strong>{group.label}</strong>
                    <small>{group.tags.length} tags</small>
                  </span>
                </button>
              ))}
            </nav>

            {selectedGroup ? (
              <div className="groupEditor tagGroupEditor">
                <div className="tagGroupFields">
                  <label className="field">
                    <span>Título</span>
                    <input
                      value={selectedGroup.label}
                      onChange={(event) =>
                        updateSelectedGroup("label", event.target.value)
                      }
                    />
                  </label>
                  <label className="field tagGroupDescriptionField">
                    <span>Descrição</span>
                    <input
                      value={selectedGroup.description}
                      onChange={(event) =>
                        updateSelectedGroup("description", event.target.value)
                      }
                    />
                  </label>
                  <label className="field colorField">
                    <span>Cor</span>
                    <input
                      type="color"
                      value={selectedGroup.color || DEFAULT_TAG_GROUP_COLOR}
                      onChange={(event) =>
                        updateSelectedGroup("color", event.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="tagGroupTagsSection">
                  <div>
                    <strong>Tags do grupo</strong>
                    <span>{selectedGroup.tags.length} itens cadastrados</span>
                  </div>
                </div>

                <div className="tagCloud">
                  {selectedGroup.tags.map((tagId) => (
                    <span
                      className="editableTag"
                      key={tagId}
                      style={{
                        borderColor:
                          selectedGroup.color || DEFAULT_TAG_GROUP_COLOR,
                      }}
                    >
                      {tagId}
                      <button
                        type="button"
                        onClick={() => removeTag(tagId)}
                        title="Remover tag"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  ))}
                  <button
                    className="addTagChip"
                    onClick={openAddTagDialog}
                    type="button"
                  >
                    <Plus size={14} />
                    Nova tag
                  </button>
                </div>
              </div>
            ) : (
              <div className="emptyState">Nenhum grupo de tags cadastrado.</div>
            )}
          </div>
        </section>
      ) : null}

      {addingTag && selectedGroup ? (
        <div
          className="taxonomyEditBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddTagDialog();
          }}
        >
          <section
            aria-label="Adicionar tag"
            aria-modal="true"
            className="taxonomyEditDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Nova tag</strong>
                <span>Adicione uma tag ao grupo {selectedGroup.label}.</span>
              </div>
            </header>
            <form onSubmit={addTag}>
              <label className="field">
                <span>Nome da tag</span>
                <input
                  autoFocus
                  onChange={(event) => setNewTag(event.target.value)}
                  placeholder="Ex.: erro sincronização"
                  value={newTag}
                />
              </label>
              <div className="dialogActions">
                <button
                  className="secondaryButton"
                  data-dialog-close
                  onClick={closeAddTagDialog}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="primaryButton"
                  disabled={
                    !slugify(newTag) ||
                    selectedGroup.tags.includes(slugify(newTag))
                  }
                  type="submit"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
