import { Save, Tags } from "lucide-react";

import { DEFAULT_TAG_GROUP_COLOR } from "../../../../constants/issues.js";
import { TaxonomySelector } from "../../../taxonomy/TaxonomySelector.jsx";
import { filterTaxonomyForApplication } from "../../../taxonomy/scope.js";
import {
  TagGroupDialog,
  TagSelectionChips,
  TaxonomySelectionChips,
} from "./ClassificationControls.jsx";

export function IssueKnowledgeTab({
  activeTagGroup,
  addTaxonomyCatalogNode,
  applications,
  classificationDraft,
  classificationMessage,
  draftSelectedTagEntries,
  editTaxonomyCatalogNode,
  hasClassificationChanges,
  issue,
  removeGroupTag,
  removeTaxonomy,
  saveClassification,
  savingClassification,
  savingTaxonomyCatalog,
  selectedTaxonomies,
  setActiveTagGroupId,
  taxonomyById,
  taxonomyError,
  taxonomyLoading,
  taxonomyPackage,
  toggleGroupTag,
  updateKbSummary,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  return (
    <section className="detailSection">
      {taxonomyError ? (
        <div className="errorBox dialogError">{taxonomyError}</div>
      ) : null}
      {classificationMessage ? (
        <div className="infoBox">{classificationMessage}</div>
      ) : null}
      {hasClassificationChanges ? (
        <div className="warningBox">
          Há alterações de classificação ainda não gravadas.
        </div>
      ) : null}
      {taxonomyLoading ? (
        <div className="loadingLine">Carregando assuntos...</div>
      ) : null}

      <div className="classificationGrid">
        <section className="classificationPanel kbSummaryPanel">
          <label className="field">
            <span>Sumário do que foi feito</span>
            <textarea
              onChange={(event) => updateKbSummary(event.target.value)}
              placeholder="Registre um resumo objetivo da análise, correção ou encaminhamento realizado."
              rows={4}
              value={classificationDraft.summary}
            />
          </label>
        </section>

        <section className="classificationPanel taxonomyChooserPanel">
          <div className="sectionTitleRow">
            <h3>Tags</h3>
            <span>
              <Tags size={14} />
              {draftSelectedTagEntries?.length || 0}
            </span>
          </div>
          {taxonomyPackage?.tagGroups?.length ? (
            <div className="tagGroupButtons" aria-label="Grupos de tags">
              {taxonomyPackage.tagGroups.map((group) => (
                <button
                  className="tagGroupButton"
                  key={group.id}
                  onClick={() => setActiveTagGroupId(group.id)}
                  style={{
                    backgroundColor: group.color || DEFAULT_TAG_GROUP_COLOR,
                  }}
                  type="button"
                >
                  {group.label}
                </button>
              ))}
            </div>
          ) : null}
          <TagSelectionChips
            onRemove={removeGroupTag}
            tags={draftSelectedTagEntries}
          />
        </section>

        <section className="classificationPanel taxonomyChooserPanel">
          <div className="sectionTitleRow">
            <h3>Assunto</h3>
            <span>
              <Tags size={14} />
              {selectedTaxonomies?.length || 0}
            </span>
          </div>
          <TaxonomySelectionChips
            onClear={() => updateTaxonomies([])}
            onRemove={removeTaxonomy}
            primaryTaxonomyId={classificationDraft.primaryTaxonomyId}
            selectedTaxonomies={selectedTaxonomies}
            taxonomyById={taxonomyById}
          />
          <TaxonomySelector
            applications={applications}
            multiple
            nodes={filterTaxonomyForApplication(
              taxonomyPackage?.taxonomy || [],
              issue.applicationId,
            )}
            onAddNode={savingTaxonomyCatalog ? null : addTaxonomyCatalogNode}
            onChange={updateTaxonomies}
            onEditNode={savingTaxonomyCatalog ? null : editTaxonomyCatalogNode}
            onPrimaryChange={updatePrimaryTaxonomy}
            primaryValue={classificationDraft.primaryTaxonomyId}
            value={selectedTaxonomies}
          />
          <TagGroupDialog
            group={activeTagGroup}
            onClose={() => setActiveTagGroupId("")}
            onToggleTag={toggleGroupTag}
            selectedTags={
              activeTagGroup
                ? classificationDraft.tags[activeTagGroup.id] || []
                : []
            }
          />
        </section>
      </div>

      <div className="dialogActions">
        <button
          className="primaryButton"
          disabled={
            savingClassification || !hasClassificationChanges || !issue.id
          }
          onClick={saveClassification}
          type="button"
        >
          <Save size={16} />
          {savingClassification ? "Gravando..." : "Gravar KB"}
        </button>
      </div>
    </section>
  );
}
