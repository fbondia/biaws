import { Settings2, Upload, X } from "lucide-react";

import { ImportEmlItem } from "../../ImportEmlItem.jsx";

export function ImportEmlMainDialog({
  addFiles,
  analyzeEntry,
  applications,
  busy,
  canClassify,
  canConfigureSanitization,
  classificationScope,
  components,
  defaultType,
  dragging,
  entries,
  importEntry,
  importReady,
  inputRef,
  onClose,
  openClassificationDialog,
  openContextDialog,
  readyCount,
  removeEntry,
  setDragging,
  setSanitizationOpen,
  typeOptions,
  updateOverride,
}) {
  return (
    <section
      className="issueDialog importDialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
    >
      <header className="dialogHeader">
        <div className="dialogTitleBlock">
          <div className="dialogKicker">
            <span className="typeBadge">Importação de EML</span>
          </div>
          <h2 id="import-title">Importar chamados</h2>
        </div>
        <div className="dialogHeaderActions">
          {canConfigureSanitization ? (
            <button
              className="primaryButton"
              disabled={busy}
              onClick={() => setSanitizationOpen(true)}
              type="button"
            >
              <Settings2 size={16} /> Sanitização
            </button>
          ) : null}
          <button
            className="iconButton"
            disabled={busy}
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="dialogBody importDialogBody">
        <button
          className={dragging ? "emlDropZone activeEmlDropZone" : "emlDropZone"}
          disabled={!applications.length}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void addFiles(event.dataTransfer.files);
          }}
          type="button"
        >
          <Upload size={24} />
          <strong>Arraste arquivos EML ou clique para selecionar</strong>
          <span>
            Os arquivos serão analisados individualmente antes da importação.
          </span>
        </button>
        <input
          accept=".eml,message/rfc822"
          hidden
          multiple
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />

        <div className="emlImportList">
          {entries.map((entry) => (
            <ImportEmlItem
              applications={applications}
              canClassify={canClassify}
              classificationScope={classificationScope}
              components={components}
              defaultType={defaultType}
              entry={entry}
              key={entry.key}
              onImport={() => void importEntry(entry)}
              onOpenContext={() => openContextDialog(entry)}
              onOpenTags={() => openClassificationDialog(entry, "tags")}
              onOpenTaxonomy={() => openClassificationDialog(entry, "taxonomy")}
              onRecalculate={() => void analyzeEntry(entry, entry.overrides)}
              onRemove={() => removeEntry(entry.key)}
              onUpdateOverride={(field, value) =>
                updateOverride(entry.key, field, value)
              }
              typeOptions={typeOptions}
            />
          ))}
        </div>
      </div>

      <footer className="importDialogFooter">
        <span>
          {entries.length} arquivo(s), {readyCount} pronto(s) para importar
        </span>
        <div>
          <button
            className="secondaryButton"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Fechar
          </button>
          <button
            className="primaryButton"
            disabled={busy || !readyCount}
            onClick={() => void importReady()}
            type="button"
          >
            Importar arquivos válidos
          </button>
        </div>
      </footer>
    </section>
  );
}
