import { FolderTree, Tags } from "lucide-react";
import { useState } from "react";

import { DEFAULT_TAG_GROUP_COLOR } from "../../../../../constants/issues.js";
import { FilterDialogButton } from "../../../../shared/FilterDialogButton.jsx";
import { TaxonomySelector } from "../../../../taxonomy/TaxonomySelector/index.jsx";
import { filterTaxonomyForApplication } from "../../../../taxonomy/scope.js";
import { taxonomyIds } from "../../model.js";

function TaxonomyDialog({
  applications,
  classification,
  disabled,
  nodes,
  onClose,
  onUpdateClassification,
  onUpdateTaxonomies,
  selectedIds,
}) {
  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="Selecionar classificações do documento"
        aria-modal="true"
        className="tagFilterDialog taxonomyFilterDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Selecionar classificações</strong>
            <span>Selecione os assuntos e defina um deles como principal.</span>
          </div>
          {selectedIds.length ? (
            <small>{selectedIds.length} selecionada(s)</small>
          ) : null}
        </header>
        <div className="taxonomyFilterDialogContent">
          {nodes.length ? (
            <TaxonomySelector
              applications={applications}
              disabledIds={disabled ? taxonomyIds(nodes) : []}
              multiple
              nodes={nodes}
              onChange={disabled ? () => {} : onUpdateTaxonomies}
              onPrimaryChange={
                disabled
                  ? undefined
                  : (primaryTaxonomyId) =>
                      onUpdateClassification({
                        primaryTaxonomyId,
                        secondaryTaxonomyIds: selectedIds.filter(
                          (id) => id !== primaryTaxonomyId,
                        ),
                      })
              }
              primaryValue={classification.primaryTaxonomyId}
              value={selectedIds}
            />
          ) : (
            <div className="emptyState compactEmpty">
              Nenhuma taxonomia disponível para este contexto.
            </div>
          )}
        </div>
        <footer>
          {!disabled && selectedIds.length ? (
            <button
              className="secondaryButton clearDialogSelectionButton"
              onClick={() => onUpdateTaxonomies([])}
              type="button"
            >
              Limpar seleção
            </button>
          ) : null}
          <button
            className="primaryButton"
            data-dialog-close
            onClick={onClose}
            type="button"
          >
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
}

function TagOption({ checked, color, disabled, onChange, tagId }) {
  return (
    <label
      className={
        checked ? "tagFilterOption selectedTagFilterOption" : "tagFilterOption"
      }
      style={{ borderColor: checked ? color : undefined }}
    >
      <input
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        type="checkbox"
      />
      <span>{tagId}</span>
    </label>
  );
}

function TagsDialog({
  classification,
  disabled,
  groups,
  onClear,
  onClose,
  onToggleTag,
  selectedCount,
}) {
  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="Selecionar tags do documento"
        aria-modal="true"
        className="tagFilterDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Selecionar tags</strong>
            <span>Marque as tags que devem identificar o documento.</span>
          </div>
          {selectedCount ? <small>{selectedCount} selecionada(s)</small> : null}
        </header>
        {groups.length ? (
          <div className="tagFilterGroups">
            {groups.map((group) => {
              const color = group.color || DEFAULT_TAG_GROUP_COLOR;
              return (
                <div className="tagFilterGroup" key={group.id}>
                  <strong>
                    <span
                      className="tagColorSwatch"
                      style={{ backgroundColor: color }}
                    />
                    {group.label}
                  </strong>
                  <div className="tagFilterOptions">
                    {(group.tags || []).map((tagId) => (
                      <TagOption
                        checked={Boolean(
                          classification.tags?.[group.id]?.includes(tagId),
                        )}
                        color={color}
                        disabled={disabled}
                        key={tagId}
                        onChange={() => onToggleTag(group.id, tagId)}
                        tagId={tagId}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="emptyState compactEmpty">Nenhuma tag disponível.</div>
        )}
        <footer>
          {!disabled && selectedCount ? (
            <button
              className="secondaryButton clearDialogSelectionButton"
              onClick={onClear}
              type="button"
            >
              Limpar seleção
            </button>
          ) : null}
          <button
            className="primaryButton"
            data-dialog-close
            onClick={onClose}
            type="button"
          >
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
}

export function DocumentClassificationSelectors({
  applications,
  disabled,
  draft,
  onChange,
  taxonomyPackage,
}) {
  const [taxonomyDialogOpen, setTaxonomyDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const classification = draft.classification || {
    primaryTaxonomyId: "",
    secondaryTaxonomyIds: [],
    tags: {},
  };
  const selectedIds = [
    ...new Set(
      [
        classification.primaryTaxonomyId,
        ...(classification.secondaryTaxonomyIds || []),
      ].filter(Boolean),
    ),
  ];
  const taxonomyNodes = filterTaxonomyForApplication(
    taxonomyPackage?.taxonomy || [],
    draft.applicationId,
  );
  const tagGroups = taxonomyPackage?.tagGroups || [];
  const selectedTagCount = Object.values(classification.tags || {}).reduce(
    (count, values) => count + values.length,
    0,
  );

  function updateClassification(next) {
    onChange({ ...draft, classification: { ...classification, ...next } });
  }

  function updateTaxonomies(nextIds) {
    const primaryTaxonomyId = nextIds.includes(classification.primaryTaxonomyId)
      ? classification.primaryTaxonomyId
      : nextIds[0] || "";
    updateClassification({
      primaryTaxonomyId,
      secondaryTaxonomyIds: nextIds.filter((id) => id !== primaryTaxonomyId),
    });
  }

  function toggleTag(groupId, tagId) {
    const selected = classification.tags?.[groupId] || [];
    updateClassification({
      tags: {
        ...(classification.tags || {}),
        [groupId]: selected.includes(tagId)
          ? selected.filter((id) => id !== tagId)
          : [...selected, tagId],
      },
    });
  }

  return (
    <>
      <FilterDialogButton
        count={selectedIds.length}
        icon={FolderTree}
        label="Classificações"
        onClick={() => setTaxonomyDialogOpen(true)}
        summary={
          selectedIds.length
            ? `${selectedIds.length} selecionada(s)`
            : "Nenhuma classificação"
        }
      />
      <FilterDialogButton
        count={selectedTagCount}
        icon={Tags}
        label="Tags"
        onClick={() => setTagsDialogOpen(true)}
        summary={
          selectedTagCount
            ? `${selectedTagCount} selecionada(s)`
            : "Nenhuma tag"
        }
      />

      {taxonomyDialogOpen ? (
        <TaxonomyDialog
          applications={applications}
          classification={classification}
          disabled={disabled}
          nodes={taxonomyNodes}
          onClose={() => setTaxonomyDialogOpen(false)}
          onUpdateClassification={updateClassification}
          onUpdateTaxonomies={updateTaxonomies}
          selectedIds={selectedIds}
        />
      ) : null}

      {tagsDialogOpen ? (
        <TagsDialog
          classification={classification}
          disabled={disabled}
          groups={tagGroups}
          onClear={() => updateClassification({ tags: {} })}
          onClose={() => setTagsDialogOpen(false)}
          onToggleTag={toggleTag}
          selectedCount={selectedTagCount}
        />
      ) : null}
    </>
  );
}
