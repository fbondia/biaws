import {
  DEFAULT_TAG_GROUP_COLOR,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from "../../../../constants/issues.js";
import { TaxonomySelector } from "../../../taxonomy/TaxonomySelector/index.jsx";
import { readSelectedTags, toggleSelectedTag } from "../model.js";
import { OptionFilterDialog } from "./OptionFilterDialog.jsx";

export function IssueFilterDialogs({
  draftFilters,
  onChange,
  optionDialogOpen,
  selectedTagCount,
  selectedTaxonomies,
  setOptionDialogOpen,
  setTagsDialogOpen,
  setTaxonomyDialogOpen,
  tagGroups,
  tagsDialogOpen,
  taxonomyDialogOpen,
  taxonomyPackage,
}) {
  return (
    <>
      {tagsDialogOpen ? (
        <TagFilterDialog
          draftFilters={draftFilters}
          onChange={onChange}
          selectedTagCount={selectedTagCount}
          setTagsDialogOpen={setTagsDialogOpen}
          tagGroups={tagGroups}
        />
      ) : null}
      {optionDialogOpen === "type" ? (
        <OptionFilterDialog
          description="Selecione um ou mais tipos para restringir os resultados."
          draftFilters={draftFilters}
          field="type"
          onChange={onChange}
          onClose={() => setOptionDialogOpen("")}
          options={TYPE_OPTIONS}
          title="Filtrar por tipos"
        />
      ) : null}
      {optionDialogOpen === "status" ? (
        <OptionFilterDialog
          description="Selecione um ou mais status para restringir os resultados."
          draftFilters={draftFilters}
          field="status"
          onChange={onChange}
          onClose={() => setOptionDialogOpen("")}
          options={STATUS_OPTIONS}
          title="Filtrar por status"
        />
      ) : null}
      {taxonomyDialogOpen ? (
        <TaxonomyFilterDialog
          onChange={onChange}
          selectedTaxonomies={selectedTaxonomies}
          setTaxonomyDialogOpen={setTaxonomyDialogOpen}
          taxonomyPackage={taxonomyPackage}
        />
      ) : null}
    </>
  );
}

function TagFilterDialog({
  draftFilters,
  onChange,
  selectedTagCount,
  setTagsDialogOpen,
  tagGroups,
}) {
  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setTagsDialogOpen(false);
      }}
    >
      <section
        aria-label="Filtrar por tags"
        aria-modal="true"
        className="tagFilterDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Filtrar por tags</strong>
            <span>
              Selecione uma ou mais tags para restringir os resultados.
            </span>
          </div>
          {selectedTagCount ? (
            <small>{selectedTagCount} selecionada(s)</small>
          ) : null}
        </header>
        <div className="tagFilterGroups">
          {tagGroups.map((group) => (
            <TagFilterGroup
              draftFilters={draftFilters}
              group={group}
              key={group.id}
              onChange={onChange}
            />
          ))}
        </div>
        <footer>
          {selectedTagCount ? (
            <button
              className="secondaryButton clearDialogSelectionButton"
              onClick={() =>
                tagGroups.forEach((group) => onChange(`tag_${group.id}`, ""))
              }
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
  );
}

function TagFilterGroup({ draftFilters, group, onChange }) {
  return (
    <div className="tagFilterGroup">
      <strong>
        <span
          className="tagColorSwatch"
          style={{ backgroundColor: group.color || DEFAULT_TAG_GROUP_COLOR }}
        />
        {group.label}
      </strong>
      <div className="tagFilterOptions">
        {(group.tags || []).map((tagId) => {
          const checked = readSelectedTags(draftFilters, group.id).includes(
            tagId,
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
                onChange={() =>
                  toggleSelectedTag(draftFilters, group.id, tagId, onChange)
                }
                type="checkbox"
              />
              <span>{tagId}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function TaxonomyFilterDialog({
  onChange,
  selectedTaxonomies,
  setTaxonomyDialogOpen,
  taxonomyPackage,
}) {
  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setTaxonomyDialogOpen(false);
      }}
    >
      <section
        aria-label="Filtrar por classificações"
        aria-modal="true"
        className="tagFilterDialog taxonomyFilterDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Filtrar por classificações</strong>
            <span>Selecione uma ou mais classificações da árvore.</span>
          </div>
          {selectedTaxonomies.length ? (
            <small>{selectedTaxonomies.length} selecionada(s)</small>
          ) : null}
        </header>
        <div className="taxonomyFilterDialogContent">
          <TaxonomySelector
            multiple
            nodes={taxonomyPackage.taxonomy}
            onChange={(values) => onChange("taxonomy", values.join(","))}
            value={selectedTaxonomies}
          />
        </div>
        <footer>
          {selectedTaxonomies.length ? (
            <button
              className="secondaryButton clearDialogSelectionButton"
              onClick={() => onChange("taxonomy", "")}
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
  );
}
