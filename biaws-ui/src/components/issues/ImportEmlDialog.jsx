import {
  CheckCircle2,
  LoaderCircle,
  Mail,
  Settings2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { importEml } from "../../api.js";
import { TYPE_OPTIONS } from "../../constants/issues.js";
import { CatalogContextFields } from "../catalog/CatalogContextFields.jsx";
import { EmlSanitizationDialog } from "./EmlSanitizationDialog.jsx";

function entryStatus(entry) {
  if (entry.status === "analyzing") return "Analisando";
  if (entry.status === "importing") return "Importando";
  if (entry.status === "done") return "Importado";
  if (entry.status === "error") return "Erro";
  return entry.preview?.action === "update" ? "Atualizar issue" : "Nova issue";
}

function StatusIcon({ status }) {
  if (status === "analyzing" || status === "importing") {
    return <LoaderCircle className="spinIcon" size={18} />;
  }
  if (status === "done")
    return <CheckCircle2 className="importSuccessIcon" size={18} />;
  if (status === "error")
    return <XCircle className="importErrorIcon" size={18} />;
  return <Mail size={18} />;
}

export function ImportEmlDialog({
  applications = [],
  canConfigureSanitization = false,
  components = [],
  onClose,
  onImported,
  workspace,
}) {
  const [entries, setEntries] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [sanitizationOpen, setSanitizationOpen] = useState(false);
  const [context, setContext] = useState({
    applicationId: applications[0]?.id || "",
    affectedComponentIds: [],
  });
  const inputRef = useRef(null);
  const typeOptions = TYPE_OPTIONS.filter((option) => option.value);
  const defaultType = typeOptions[0]?.value || "";

  useEffect(() => {
    if (context.applicationId || !applications[0]?.id) return;
    setContext((current) => ({
      ...current,
      applicationId: applications[0].id,
    }));
  }, [applications, context.applicationId]);

  function updateEntry(key, patch) {
    setEntries((current) =>
      current.map((entry) =>
        entry.key === key ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function updateOverride(key, field, value) {
    setEntries((current) =>
      current.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              overrides: {
                ...entry.overrides,
                [field]: value,
              },
              preview: entry.preview
                ? {
                    ...entry.preview,
                    issue: { ...entry.preview.issue, [field]: value },
                  }
                : entry.preview,
            }
          : entry,
      ),
    );
  }

  async function analyzeEntry(entry, overrides = null) {
    updateEntry(entry.key, { status: "analyzing", error: "" });
    try {
      const preview = await importEml(entry.file, {
        dryRun: true,
        workspaceId: workspace?.id,
        ...context,
        ...(overrides || {}),
      });
      updateEntry(entry.key, {
        preview,
        overrides: overrides || {
          id: preview.issue.id || "",
          type: preview.issue.type || defaultType,
          title: preview.issue.title || "",
        },
        status: "ready",
        error: "",
      });
    } catch (error) {
      updateEntry(entry.key, { status: "error", error: error.message });
    }
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((file) =>
      file.name.toLowerCase().endsWith(".eml"),
    );
    const additions = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: "analyzing",
      preview: null,
      overrides: null,
      error: "",
    }));
    setEntries((current) => [...current, ...additions]);
    for (const entry of additions) await analyzeEntry(entry);
  }

  async function importEntry(entry) {
    updateEntry(entry.key, { status: "importing", error: "" });
    try {
      const result = await importEml(entry.file, {
        workspaceId: workspace?.id,
        ...context,
        ...(entry.overrides || {}),
      });
      updateEntry(entry.key, { result, status: "done" });
      onImported?.(result);
    } catch (error) {
      updateEntry(entry.key, { status: "error", error: error.message });
    }
  }

  async function importReady() {
    for (const entry of entries.filter(
      (item) =>
        item.status === "ready" && isValidEntry(item, context.applicationId),
    )) {
      await importEntry(entry);
    }
  }

  async function handleSanitizationSaved() {
    for (const entry of entries.filter((item) => item.status !== "done")) {
      await analyzeEntry(entry);
    }
  }

  const busy = entries.some((entry) =>
    ["analyzing", "importing"].includes(entry.status),
  );
  const readyCount = entries.filter(
    (entry) =>
      entry.status === "ready" && isValidEntry(entry, context.applicationId),
  ).length;

  function removeEntry(entryKey) {
    setEntries((current) => current.filter((item) => item.key !== entryKey));
  }

  return (
    <div
      className="dialogBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
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
                className="secondaryButton"
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
          <section className="emlImportContext">
            <h3>Contexto dos chamados</h3>
            <p>
              A aplicação é obrigatória e será usada em todos os arquivos desta
              importação.
            </p>
            <CatalogContextFields
              affectedComponentIds={context.affectedComponentIds}
              applicationId={context.applicationId}
              applications={applications}
              components={components}
              onChange={setContext}
            />
          </section>
          <button
            className={
              dragging ? "emlDropZone activeEmlDropZone" : "emlDropZone"
            }
            disabled={!context.applicationId}
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
              <article className="emlImportItem" key={entry.key}>
                <div className="emlImportStatus">
                  <StatusIcon status={entry.status} />
                </div>
                <div className="emlImportMain">
                  <div className="emlImportTitle">
                    <strong>{entry.file.name}</strong>
                    <span>{entryStatus(entry)}</span>
                  </div>
                  {entry.preview ? (
                    <div className="emlImportPreview">
                      <div className="emlImportEditableFields">
                        <label>
                          <span>Código</span>
                          <input
                            disabled={entry.status === "importing"}
                            onChange={(event) =>
                              updateOverride(
                                entry.key,
                                "id",
                                event.target.value,
                              )
                            }
                            value={entry.overrides?.id || ""}
                          />
                        </label>
                        <label>
                          <span>Tipo</span>
                          <select
                            disabled={entry.status === "importing"}
                            onChange={(event) =>
                              updateOverride(
                                entry.key,
                                "type",
                                event.target.value,
                              )
                            }
                            value={entry.overrides?.type || defaultType}
                          >
                            {typeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="emlImportTitleField">
                          <span>Título</span>
                          <input
                            disabled={entry.status === "importing"}
                            onChange={(event) =>
                              updateOverride(
                                entry.key,
                                "title",
                                event.target.value,
                              )
                            }
                            value={entry.overrides?.title || ""}
                          />
                        </label>
                        <button
                          className="secondaryButton emlRecalculateButton"
                          onClick={() =>
                            void analyzeEntry(entry, entry.overrides)
                          }
                          type="button"
                        >
                          Recalcular prévia
                        </button>
                      </div>
                      <span>
                        {entry.preview.comments.new} comentário(s) novo(s)
                      </span>
                      <span>{entry.preview.attachments.length} anexo(s)</span>
                      {entry.preview.reopenedIssue ? (
                        <em>A issue será reaberta.</em>
                      ) : null}
                    </div>
                  ) : null}
                  {entry.error ? (
                    <div className="emlImportError">{entry.error}</div>
                  ) : null}
                </div>
                <div className="emlImportActions">
                  {entry.status === "ready" ? (
                    <button
                      className="secondaryButton"
                      disabled={!isValidEntry(entry, context.applicationId)}
                      onClick={() => void importEntry(entry)}
                      type="button"
                    >
                      Importar
                    </button>
                  ) : null}
                  {!["analyzing", "importing"].includes(entry.status) ? (
                    <button
                      className="iconButton"
                      onClick={() => removeEntry(entry.key)}
                      title="Remover"
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
              </article>
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
      {sanitizationOpen ? (
        <EmlSanitizationDialog
          applicationId={context.applicationId}
          onClose={() => setSanitizationOpen(false)}
          onSaved={handleSanitizationSaved}
          sampleFile={entries.find((entry) => entry.status !== "done")?.file}
          workspaceId={workspace?.id}
        />
      ) : null}
    </div>
  );
}

function isValidEntry(entry, applicationId) {
  return Boolean(
    applicationId &&
    entry.overrides?.id?.trim() &&
    entry.overrides?.title?.trim() &&
    TYPE_OPTIONS.some(
      (option) => option.value && option.value === entry.overrides?.type,
    ),
  );
}
