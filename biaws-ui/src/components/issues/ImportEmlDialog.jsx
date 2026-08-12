import { Settings2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { importEml } from "../../api.js";
import {
  DEFAULT_TAG_GROUP_COLOR,
  TYPE_OPTIONS,
} from "../../constants/issues.js";
import { CatalogContextFields } from "../catalog/CatalogContextFields.jsx";
import { TaxonomySelector } from "../taxonomy/TaxonomySelector.jsx";
import { filterTaxonomyForApplication } from "../taxonomy/scope.js";
import { EmlSanitizationDialog } from "./EmlSanitizationDialog.jsx";
import {
  canClassifyContext,
  ImportEmlItem,
  isValidEmlEntry,
} from "./ImportEmlItem.jsx";
import {
  contextFromPreviewIssue,
  shouldRetryContextDiscovery,
} from "./emlImportModel.js";

const EMPTY_CLASSIFICATION = {
  primaryTaxonomyId: "",
  secondaryTaxonomyIds: [],
  summary: "",
  tags: {},
};

export function ImportEmlDialog({
  applications = [],
  canClassify = false,
  canConfigureSanitization = false,
  classificationScope = null,
  components = [],
  onClose,
  onImported,
  taxonomyPackage,
  workspace,
}) {
  const [entries, setEntries] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [sanitizationOpen, setSanitizationOpen] = useState(false);
  const [contextEntryKey, setContextEntryKey] = useState("");
  const [contextDraft, setContextDraft] = useState({
    applicationId: "",
    affectedComponentIds: [],
  });
  const [classificationEntryKey, setClassificationEntryKey] = useState("");
  const [classificationDraft, setClassificationDraft] =
    useState(EMPTY_CLASSIFICATION);
  const inputRef = useRef(null);
  const typeOptions = TYPE_OPTIONS.filter((option) => option.value);
  const defaultType = typeOptions[0]?.value || "";

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

  async function analyzeEntry(
    entry,
    overrides = null,
    entryContext = entry.context,
    discoverContext = false,
  ) {
    updateEntry(entry.key, { status: "analyzing", error: "" });
    try {
      let resolvedContext = entryContext;
      let preview;
      try {
        preview = await requestEntryPreview(
          entry,
          overrides,
          entryContext,
          discoverContext,
        );
      } catch (error) {
        if (
          !shouldRetryContextDiscovery(error, discoverContext, entry.context)
        ) {
          throw error;
        }
        resolvedContext = entry.context;
        preview = await requestEntryPreview(
          entry,
          overrides,
          resolvedContext,
          false,
        );
      }
      if (discoverContext && !resolvedContext) {
        resolvedContext = contextFromPreviewIssue(preview.issue, entry.context);
      }
      updateEntry(entry.key, {
        preview,
        context: resolvedContext || entry.context,
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

  function requestEntryPreview(
    entry,
    overrides,
    entryContext,
    discoverContext,
  ) {
    return importEml(entry.file, {
      dryRun: true,
      ...(discoverContext
        ? {}
        : { workspaceId: workspace?.id, ...(entryContext || {}) }),
      ...(entry.classification ? { classification: entry.classification } : {}),
      ...(overrides || {}),
    });
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((file) =>
      file.name.toLowerCase().endsWith(".eml"),
    );
    const additions = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      context: {
        applicationId: applications[0]?.id || "",
        affectedComponentIds: [],
      },
      classification: null,
      status: "analyzing",
      preview: null,
      overrides: null,
      error: "",
    }));
    setEntries((current) => [...current, ...additions]);
    for (const entry of additions) {
      await analyzeEntry(entry, null, null, true);
    }
  }

  async function importEntry(entry) {
    updateEntry(entry.key, { status: "importing", error: "" });
    try {
      const result = await importEml(entry.file, {
        workspaceId: workspace?.id,
        ...entry.context,
        ...(entry.classification
          ? { classification: entry.classification }
          : {}),
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
      (item) => item.status === "ready" && isValidEmlEntry(item),
    )) {
      await importEntry(entry);
    }
  }

  async function handleSanitizationSaved() {
    for (const entry of entries.filter((item) => item.status !== "done")) {
      await analyzeEntry(entry, entry.overrides);
    }
  }

  function openContextDialog(entry) {
    setContextEntryKey(entry.key);
    setContextDraft(entry.context);
  }

  async function applyContextToEntries(applyToAll) {
    const targets = entries.filter(
      (entry) =>
        entry.status !== "done" &&
        (applyToAll || entry.key === contextEntryKey),
    );
    const nextContext = {
      applicationId: contextDraft.applicationId,
      affectedComponentIds: [...contextDraft.affectedComponentIds],
    };
    setContextEntryKey("");
    for (const entry of targets) {
      const updatedEntry = { ...entry, context: nextContext };
      updateEntry(entry.key, { context: nextContext });
      await analyzeEntry(updatedEntry, entry.overrides, nextContext);
    }
  }

  function openClassificationDialog(entry) {
    setClassificationEntryKey(entry.key);
    setClassificationDraft(
      cloneClassification(
        entry.classification || entry.preview?.issue?.classification,
      ),
    );
  }

  function updateTaxonomies(taxonomyIds) {
    setClassificationDraft((current) => {
      const primaryTaxonomyId = taxonomyIds.includes(current.primaryTaxonomyId)
        ? current.primaryTaxonomyId
        : taxonomyIds[0] || "";
      return {
        ...current,
        primaryTaxonomyId,
        secondaryTaxonomyIds: taxonomyIds.filter(
          (taxonomyId) => taxonomyId !== primaryTaxonomyId,
        ),
      };
    });
  }

  function updatePrimaryTaxonomy(primaryTaxonomyId) {
    setClassificationDraft((current) => ({
      ...current,
      primaryTaxonomyId,
      secondaryTaxonomyIds: selectedTaxonomyIds(current).filter(
        (taxonomyId) => taxonomyId !== primaryTaxonomyId,
      ),
    }));
  }

  function toggleTag(groupId, tagId) {
    setClassificationDraft((current) => {
      const selectedTags = current.tags[groupId] || [];
      return {
        ...current,
        tags: {
          ...current.tags,
          [groupId]: selectedTags.includes(tagId)
            ? selectedTags.filter((selectedTag) => selectedTag !== tagId)
            : [...selectedTags, tagId],
        },
      };
    });
  }

  async function applyClassificationToEntries(applyToAll) {
    const targets = entries.filter(
      (entry) =>
        entry.status !== "done" &&
        canClassifyContext(entry.context, classificationScope) &&
        (applyToAll || entry.key === classificationEntryKey),
    );
    const nextClassification = cloneClassification(classificationDraft);
    setClassificationEntryKey("");
    for (const entry of targets) {
      const updatedEntry = {
        ...entry,
        classification: nextClassification,
      };
      updateEntry(entry.key, { classification: nextClassification });
      await analyzeEntry(updatedEntry, entry.overrides);
    }
  }

  const busy = entries.some((entry) =>
    ["analyzing", "importing"].includes(entry.status),
  );
  const readyCount = entries.filter(
    (entry) => entry.status === "ready" && isValidEmlEntry(entry),
  ).length;
  const contextEntry = entries.find((entry) => entry.key === contextEntryKey);
  const classificationEntry = entries.find(
    (entry) => entry.key === classificationEntryKey,
  );
  const sanitizationApplicationId =
    entries.find((entry) => entry.status !== "done")?.context.applicationId ||
    applications[0]?.id ||
    "";

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
            className={
              dragging ? "emlDropZone activeEmlDropZone" : "emlDropZone"
            }
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
                onOpenClassification={() => openClassificationDialog(entry)}
                onOpenContext={() => openContextDialog(entry)}
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
      {contextEntry ? (
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
                disabled={busy || !contextDraft.applicationId}
                onClick={() => void applyContextToEntries(true)}
                type="button"
              >
                Aplicar a todos os EML
              </button>
              <button
                className="secondaryButton"
                disabled={busy}
                onClick={() => setContextEntryKey("")}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primaryButton"
                disabled={busy || !contextDraft.applicationId}
                onClick={() => void applyContextToEntries(false)}
                type="button"
              >
                Aplicar neste EML
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {classificationEntry ? (
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setClassificationEntryKey("");
            }
          }}
        >
          <section
            aria-label={`Selecionar classificação e tags de ${classificationEntry.file.name}`}
            aria-modal="true"
            className="tagFilterDialog emlClassificationDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Classificação e tags</strong>
                <span>{classificationEntry.file.name}</span>
              </div>
              <button
                className="iconButton"
                onClick={() => setClassificationEntryKey("")}
                title="Fechar"
                type="button"
              >
                <X size={18} />
              </button>
            </header>
            <div className="emlClassificationDialogContent">
              <section>
                <div className="emlClassificationSectionTitle">
                  <strong>Classificação de taxonomia</strong>
                  <span>
                    Selecione os assuntos e defina um deles como principal.
                  </span>
                </div>
                <TaxonomySelector
                  multiple
                  nodes={filterTaxonomyForApplication(
                    taxonomyPackage?.taxonomy || [],
                    classificationEntry.context.applicationId,
                  )}
                  onChange={updateTaxonomies}
                  onPrimaryChange={updatePrimaryTaxonomy}
                  primaryValue={classificationDraft.primaryTaxonomyId}
                  value={selectedTaxonomyIds(classificationDraft)}
                />
              </section>
              <section>
                <div className="emlClassificationSectionTitle">
                  <strong>Tags</strong>
                  <span>Selecione as tags que devem ser registradas.</span>
                </div>
                <div className="tagFilterGroups emlClassificationTagGroups">
                  {(taxonomyPackage?.tagGroups || []).map((group) => (
                    <div className="tagFilterGroup" key={group.id}>
                      <strong>
                        <span
                          className="tagColorSwatch"
                          style={{
                            backgroundColor:
                              group.color || DEFAULT_TAG_GROUP_COLOR,
                          }}
                        />
                        {group.label}
                      </strong>
                      <div className="tagFilterOptions">
                        {(group.tags || []).map((tagId) => {
                          const checked = (
                            classificationDraft.tags[group.id] || []
                          ).includes(tagId);
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
                                onChange={() => toggleTag(group.id, tagId)}
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
              </section>
            </div>
            <footer>
              <button
                className="secondaryButton clearDialogSelectionButton"
                disabled={busy}
                onClick={() => void applyClassificationToEntries(true)}
                type="button"
              >
                Aplicar a todos os EML
              </button>
              <button
                className="secondaryButton"
                disabled={busy}
                onClick={() => setClassificationEntryKey("")}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primaryButton"
                disabled={busy}
                onClick={() => void applyClassificationToEntries(false)}
                type="button"
              >
                Aplicar neste EML
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {sanitizationOpen ? (
        <EmlSanitizationDialog
          applicationId={sanitizationApplicationId}
          onClose={() => setSanitizationOpen(false)}
          onSaved={handleSanitizationSaved}
          sampleFile={entries.find((entry) => entry.status !== "done")?.file}
          workspaceId={workspace?.id}
        />
      ) : null}
    </div>
  );
}

function cloneClassification(classification) {
  const source = classification || EMPTY_CLASSIFICATION;
  return {
    primaryTaxonomyId: source.primaryTaxonomyId || "",
    secondaryTaxonomyIds: [...(source.secondaryTaxonomyIds || [])],
    summary: source.summary || "",
    tags: Object.fromEntries(
      Object.entries(source.tags || {}).map(([groupId, tagIds]) => [
        groupId,
        [...tagIds],
      ]),
    ),
  };
}

function selectedTaxonomyIds(classification) {
  return [
    classification.primaryTaxonomyId,
    ...classification.secondaryTaxonomyIds,
  ].filter(Boolean);
}
