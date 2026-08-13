import { X } from "lucide-react";

import { CATALOG_ENTITY_LABELS } from "./model.js";
import { BasicFields } from "./components/BasicFields.jsx";
import { DeploymentFields } from "./components/DeploymentFields.jsx";
import { CatalogEntityFooter, EntityFieldGroup } from "./components/Fields.jsx";
import { CatalogEntityOverlays } from "./components/Overlays.jsx";
import { RuntimeFields } from "./components/RuntimeFields.jsx";
import { useCatalogEntityDialog } from "./hooks/useCatalogEntityDialog.js";

function catalogEntitySections(kind) {
  if (kind === "deployment") {
    return [
      ["basic", "Dados básicos"],
      ["publications", "Publicações"],
    ];
  }
  if (kind === "runtime") {
    return [
      ["basic", "Dados básicos"],
      ["service", "Serviço"],
      ["monitoring", "Monitoramento"],
      ["documents", "Documentação"],
    ];
  }
  return [];
}

export function CatalogEntityDialog({
  entity,
  kind,
  onArchive,
  onClose,
  onSave,
  options = {},
}) {
  const controller = useCatalogEntityDialog({
    entity,
    kind,
    onArchive,
    onClose,
    onSave,
    options,
  });
  const {
    activeSection,
    addPublication,
    archive,
    archiving,
    confirmDocuments,
    documentSelectorOpen,
    draft,
    editing,
    error,
    publicationDraft,
    runtimeComponent,
    saving,
    selectedDocument,
    setActiveSection,
    setDocumentSelectorOpen,
    setPublicationDraft,
    setSelectedDocument,
    submit,
    update,
  } = controller;
  const label = CATALOG_ENTITY_LABELS[kind];
  const sections = catalogEntitySections(kind);

  function navigateTabs(event, currentIndex) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const lastIndex = sections.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowLeft"
            ? (currentIndex - 1 + sections.length) % sections.length
            : (currentIndex + 1) % sections.length;
    const nextKey = sections[nextIndex][0];
    setActiveSection(nextKey);
    event.currentTarget.parentElement
      ?.querySelector(`#catalog-entity-tab-${nextKey}`)
      ?.focus();
  }

  return (
    <div
      className="dialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !archiving)
          onClose();
      }}
    >
      <section
        aria-labelledby="catalog-entity-dialog-title"
        aria-modal="true"
        className="catalogEntityDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>{editing ? `Editar ${label}` : `Novo ${label}`}</span>
            <h2 id="catalog-entity-dialog-title">
              {draft.name || `Novo ${label}`}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            disabled={saving || archiving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          <EntityFieldGroup active={Boolean(sections.length)}>
            <div className="catalogEntityTabs" role="tablist">
              {sections.map(([key, title], index) => (
                <button
                  aria-selected={activeSection === key}
                  className={
                    activeSection === key
                      ? "catalogEntityTab activeCatalogEntityTab"
                      : "catalogEntityTab"
                  }
                  disabled={!editing && key !== "basic"}
                  key={key}
                  onClick={() => setActiveSection(key)}
                  onKeyDown={(event) => navigateTabs(event, index)}
                  role="tab"
                  id={`catalog-entity-tab-${key}`}
                  tabIndex={activeSection === key ? 0 : -1}
                  type="button"
                >
                  {title}
                </button>
              ))}
            </div>
          </EntityFieldGroup>
          <div className="catalogFormGrid">
            <BasicFields
              activeSection={activeSection}
              draft={draft}
              editing={editing}
              entity={entity}
              kind={kind}
              options={options}
              sections={sections}
              update={update}
            />
            <DeploymentFields
              activeSection={activeSection}
              addPublication={addPublication}
              draft={draft}
              editing={editing}
              kind={kind}
              options={options}
              publicationDraft={publicationDraft}
              setPublicationDraft={setPublicationDraft}
              update={update}
            />
            <RuntimeFields
              activeSection={activeSection}
              controller={controller}
              entity={entity}
              kind={kind}
              options={options}
            />
          </div>
          <CatalogEntityFooter
            archiving={archiving}
            editing={editing}
            error={error}
            onArchive={onArchive ? archive : undefined}
            onClose={onClose}
            saving={saving}
          />
        </form>
      </section>
      <CatalogEntityOverlays
        documentSelectorOpen={documentSelectorOpen}
        onConfirmDocuments={confirmDocuments}
        options={options}
        runtimeComponent={runtimeComponent}
        selectedDocument={selectedDocument}
        selectedIds={(draft.documentLinks || []).map(
          ({ documentId }) => documentId,
        )}
        setDocumentSelectorOpen={setDocumentSelectorOpen}
        setSelectedDocument={setSelectedDocument}
      />
    </div>
  );
}
