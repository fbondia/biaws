import { X } from "lucide-react";

import { DEFAULT_TAG_GROUP_COLOR } from "../../../../constants/issues.js";
import { TaxonomySelector } from "../../../taxonomy/TaxonomySelector.jsx";
import { filterTaxonomyForApplication } from "../../../taxonomy/scope.js";
import { selectedEmlTaxonomyIds } from "../../emlImportModel.js";

export function ImportEmlClassificationDialog({
  applyClassificationToEntries,
  busy,
  classificationDraft,
  classificationEntry,
  classificationSection,
  setClassificationEntryKey,
  taxonomyPackage,
  toggleTag,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  if (!classificationEntry) return null;

  const isTaxonomy = classificationSection === "taxonomy";

  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setClassificationEntryKey("");
        }
      }}
    >
      <section
        aria-label={`${isTaxonomy ? "Selecionar classificação" : "Selecionar tags"} de ${classificationEntry.file.name}`}
        aria-modal="true"
        className="tagFilterDialog emlClassificationDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>{isTaxonomy ? "Classificação / taxonomia" : "Tags"}</strong>
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
          {isTaxonomy ? (
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
                value={selectedEmlTaxonomyIds(classificationDraft)}
              />
            </section>
          ) : (
            <TagGroups
              classificationDraft={classificationDraft}
              tagGroups={taxonomyPackage?.tagGroups || []}
              toggleTag={toggleTag}
            />
          )}
        </div>
        <footer>
          <button
            className="secondaryButton clearDialogSelectionButton"
            disabled={busy}
            onClick={() => setClassificationEntryKey("")}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="secondaryButton"
            disabled={busy}
            onClick={() => void applyClassificationToEntries(true)}
            type="button"
          >
            Aplicar a todos os EML
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
  );
}

function TagGroups({ classificationDraft, tagGroups, toggleTag }) {
  return (
    <section>
      <div className="emlClassificationSectionTitle">
        <strong>Tags</strong>
        <span>Selecione as tags que devem ser registradas.</span>
      </div>
      <div className="tagFilterGroups emlClassificationTagGroups">
        {tagGroups.map((group) => (
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
  );
}
