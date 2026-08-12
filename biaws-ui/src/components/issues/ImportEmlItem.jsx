import {
  CheckCircle2,
  FolderTree,
  Layers3,
  LoaderCircle,
  Mail,
  RefreshCw,
  Tags,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

import { TYPE_OPTIONS } from "../../constants/issues.js";
import { FilterDialogButton } from "../shared/FilterDialogButton.jsx";

function entryStatus(entry) {
  if (entry.status === "analyzing") return "Analisando";
  if (entry.status === "importing") return "Importando";
  if (entry.status === "done") return "Importado";
  if (entry.status === "error") return "Erro";
  return entry.preview?.action === "update" ? "Atualizar issue" : "Nova issue";
}

function StatusIcon({ status }) {
  if (status === "analyzing" || status === "importing") {
    return <LoaderCircle className="spinIcon" size={19} />;
  }
  if (status === "done") return <CheckCircle2 size={19} />;
  if (status === "error") return <XCircle size={19} />;
  return <Mail size={19} />;
}

export function canClassifyContext(context, classificationScope) {
  return Boolean(
    classificationScope?.workspace ||
    classificationScope?.applicationIds?.includes(context.applicationId),
  );
}

export function isValidEmlEntry(entry) {
  return Boolean(
    entry.context?.applicationId &&
    entry.overrides?.id?.trim() &&
    entry.overrides?.title?.trim() &&
    TYPE_OPTIONS.some(
      (option) => option.value && option.value === entry.overrides?.type,
    ),
  );
}

function selectedTaxonomyIds(classification) {
  return [
    classification.primaryTaxonomyId,
    ...(classification.secondaryTaxonomyIds || []),
  ].filter(Boolean);
}

function formatContextSummary(context, applications, components) {
  const application = applications.find(
    ({ id }) => id === context.applicationId,
  );
  if (!application) return "Selecionar aplicação";
  const selectedComponents = components.filter((component) =>
    context.affectedComponentIds.includes(component.id),
  );
  if (!selectedComponents.length) return application.name;
  if (selectedComponents.length === 1) {
    return `${application.name} · ${selectedComponents[0].name}`;
  }
  return `${application.name} · ${selectedComponents.length} componentes`;
}

function formatTaxonomySummary(classification) {
  if (!classification) return "Nenhuma classificação";
  const taxonomyCount = selectedTaxonomyIds(classification).length;
  if (!taxonomyCount) return "Nenhuma classificação";
  return taxonomyCount === 1
    ? "1 classificação selecionada"
    : `${taxonomyCount} classificações selecionadas`;
}

function formatTagsSummary(classification) {
  if (!classification) return "Nenhuma tag";
  const tagCount = Object.values(classification.tags || {}).reduce(
    (total, tagIds) => total + tagIds.length,
    0,
  );
  if (!tagCount) return "Nenhuma tag";
  return tagCount === 1 ? "1 tag selecionada" : `${tagCount} tags selecionadas`;
}

export function ImportEmlItem({
  applications,
  canClassify,
  classificationScope,
  components,
  defaultType,
  entry,
  onImport,
  onOpenTags,
  onOpenTaxonomy,
  onOpenContext,
  onRecalculate,
  onRemove,
  onUpdateOverride,
  typeOptions,
}) {
  const working = ["analyzing", "importing"].includes(entry.status);
  const locked = working || entry.status === "done";
  const effectiveClassification =
    entry.classification || entry.preview?.issue?.classification;
  const taxonomyCount = effectiveClassification
    ? selectedTaxonomyIds(effectiveClassification).length
    : 0;
  const tagCount = effectiveClassification
    ? Object.values(effectiveClassification.tags || {}).reduce(
        (total, tagIds) => total + tagIds.length,
        0,
      )
    : 0;

  return (
    <article
      className={`emlImportItem emlImportItem--${entry.status}`}
      aria-busy={working}
    >
      <header className="emlImportItemHeader">
        <div className="emlImportStatus" aria-hidden="true">
          <StatusIcon status={entry.status} />
        </div>
        <div className="emlImportTitle">
          <strong title={entry.file.name}>{entry.file.name}</strong>
          <span className="emlImportStatusBadge">{entryStatus(entry)}</span>
        </div>
        {!working ? (
          <button
            aria-label={`Remover ${entry.file.name}`}
            className="iconButton emlRemoveButton"
            onClick={onRemove}
            title="Remover arquivo"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </header>

      <div className="emlImportAssignmentButtons">
        <FilterDialogButton
          className="emlAssignmentButton emlApplicationButton"
          count={entry.context?.applicationId ? 1 : 0}
          disabled={locked}
          icon={Layers3}
          label="Aplicação"
          onClick={onOpenContext}
          summary={formatContextSummary(
            entry.context,
            applications,
            components,
          )}
        />
        {canClassify &&
        canClassifyContext(entry.context, classificationScope) ? (
          <>
            <FilterDialogButton
              className="emlAssignmentButton emlClassificationButton"
              count={taxonomyCount}
              disabled={locked}
              icon={FolderTree}
              label="Classificação / taxonomia"
              onClick={onOpenTaxonomy}
              summary={formatTaxonomySummary(effectiveClassification)}
            />
            <FilterDialogButton
              className="emlAssignmentButton emlTagsButton"
              count={tagCount}
              disabled={locked}
              icon={Tags}
              label="Tags"
              onClick={onOpenTags}
              summary={formatTagsSummary(effectiveClassification)}
            />
          </>
        ) : null}
      </div>

      {entry.preview ? (
        <section className="emlImportPreview">
          <div className="emlImportEditableFields">
            <label>
              <span>Código</span>
              <input
                disabled={locked}
                onChange={(event) => onUpdateOverride("id", event.target.value)}
                value={entry.overrides?.id || ""}
              />
            </label>
            <label>
              <span>Tipo</span>
              <select
                disabled={locked}
                onChange={(event) =>
                  onUpdateOverride("type", event.target.value)
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
                disabled={locked}
                onChange={(event) =>
                  onUpdateOverride("title", event.target.value)
                }
                value={entry.overrides?.title || ""}
              />
            </label>
          </div>
          <div className="emlImportPreviewFooter">
            <div className="emlImportFacts">
              <span>{entry.preview.comments.new} comentário(s)</span>
              <span>{entry.preview.attachments.length} anexo(s)</span>
              {entry.preview.reopenedIssue ? (
                <em>A issue será reaberta</em>
              ) : null}
            </div>
            {entry.status !== "done" ? (
              <button
                className="secondaryButton emlRecalculateButton"
                disabled={working}
                onClick={onRecalculate}
                type="button"
              >
                <RefreshCw size={15} />
                Recalcular prévia
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {entry.error ? (
        <div className="emlImportError" role="alert">
          <XCircle size={15} />
          <span>{entry.error}</span>
        </div>
      ) : null}

      {entry.status === "ready" ? (
        <footer className="emlImportItemFooter">
          <span>Prévia validada. Revise os dados antes de importar.</span>
          <button
            className="primaryButton emlImportButton"
            disabled={!isValidEmlEntry(entry)}
            onClick={onImport}
            type="button"
          >
            <Upload size={16} />
            Importar este EML
          </button>
        </footer>
      ) : null}
    </article>
  );
}
