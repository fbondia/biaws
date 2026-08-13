import { FolderTree, Tags } from "lucide-react";
import { useState } from "react";

import { DEFAULT_TAG_GROUP_COLOR } from "../../../../../constants/issues.js";
import { FilterDialogButton } from "../../../../shared/FilterDialogButton.jsx";
import { TaxonomySelector } from "../../../../taxonomy/TaxonomySelector/index.jsx";
import { filterTaxonomyForApplication } from "../../../../taxonomy/scope.js";
import { taxonomyIds } from "../../model.js";

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
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setTaxonomyDialogOpen(false);
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
                <span>
                  Selecione os assuntos e defina um deles como principal.
                </span>
              </div>
              {selectedIds.length ? (
                <small>{selectedIds.length} selecionada(s)</small>
              ) : null}
            </header>
            <div className="taxonomyFilterDialogContent">
              {taxonomyNodes.length ? (
                <TaxonomySelector
                  applications={applications}
                  disabledIds={disabled ? taxonomyIds(taxonomyNodes) : []}
                  multiple
                  nodes={taxonomyNodes}
                  onChange={disabled ? () => {} : updateTaxonomies}
                  onPrimaryChange={
                    disabled
                      ? undefined
                      : (primaryTaxonomyId) =>
                          updateClassification({
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
                  onClick={() => updateTaxonomies([])}
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
      ) : null}

      {tagsDialogOpen ? (
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTagsDialogOpen(false);
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
              {selectedTagCount ? (
                <small>{selectedTagCount} selecionada(s)</small>
              ) : null}
            </header>
            {tagGroups.length ? (
              <div className="tagFilterGroups">
                {tagGroups.map((group) => (
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
                        const checked = Boolean(
                          classification.tags?.[group.id]?.includes(tagId),
                        );
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
                              disabled={disabled}
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
            ) : (
              <div className="emptyState compactEmpty">
                Nenhuma tag disponível.
              </div>
            )}
            <footer>
              {!disabled && selectedTagCount ? (
                <button
                  className="secondaryButton clearDialogSelectionButton"
                  onClick={() => updateClassification({ tags: {} })}
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
      ) : null}
    </>
  );
}
