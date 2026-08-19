import { X } from "lucide-react";

import { CatalogContextFields } from "../../../catalog/CatalogContextFields/index.jsx";

export function ImportEmlContextDialog({
  applications,
  applyContextToEntries,
  busy,
  components,
  contextDraft,
  contextEntry,
  setContextDraft,
  setContextEntryKey,
}) {
  if (!contextEntry) return null;

  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setContextEntryKey("");
      }}
    >
      <section
        aria-label={`Selecionar aplicação e componentes de ${contextEntry.file.name}`}
        aria-modal="true"
        className="tagFilterDialog emlContextDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Aplicação e componentes</strong>
            <span>{contextEntry.file.name}</span>
          </div>
          <button
            className="iconButton"
            onClick={() => setContextEntryKey("")}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="catalogFilterDialogContent">
          <CatalogContextFields
            affectedComponentIds={contextDraft.affectedComponentIds}
            applicationId={contextDraft.applicationId}
            applications={applications}
            components={components}
            onChange={setContextDraft}
          />
        </div>
        <footer>
          <button
            className="secondaryButton clearDialogSelectionButton"
            disabled={busy}
            onClick={() => setContextEntryKey("")}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="secondaryButton"
            disabled={busy || !contextDraft.applicationId}
            onClick={() => applyContextToEntries(true)}
            type="button"
          >
            Aplicar a todos os EML
          </button>
          <button
            className="primaryButton"
            disabled={busy || !contextDraft.applicationId}
            onClick={() => applyContextToEntries(false)}
            type="button"
          >
            Aplicar neste EML
          </button>
        </footer>
      </section>
    </div>
  );
}
