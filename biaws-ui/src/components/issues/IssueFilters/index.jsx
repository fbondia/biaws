import {
  CalendarDays,
  ClipboardList,
  Filter,
  FolderTree,
  ListChecks,
  Search,
  Tags,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  DEFAULT_TAG_GROUP_COLOR,
  DATE_FIELDS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from "../../../constants/issues.js";
import { TaxonomySelector } from "../../taxonomy/TaxonomySelector.jsx";
import { CatalogFilterFields } from "../../catalog/CatalogContextFields.jsx";
import { FilterDialogButton } from "../../shared/FilterDialogButton.jsx";
import { OptionFilterDialog } from "./components/OptionFilterDialog.jsx";
import {
  countSelectedTags,
  DATE_PERIOD_PRESETS,
  datePeriodRange,
  matchingDatePeriod,
  readSelectedOptions,
  readSelectedTags,
  readSelectedTaxonomies,
  toggleSelectedTag,
} from "./model.js";

export function IssueFilters({
  applications = [],
  components = [],
  draftFilters,
  id,
  onChange,
  onClear,
  onSubmit,
  taxonomyPackage,
}) {
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [taxonomyDialogOpen, setTaxonomyDialogOpen] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState("");
  const [selectedDatePeriod, setSelectedDatePeriod] = useState(() =>
    matchingDatePeriod(draftFilters),
  );
  const tagGroups = taxonomyPackage?.tagGroups || [];
  const selectedTagCount = countSelectedTags(draftFilters, tagGroups);
  const selectedTaxonomies = readSelectedTaxonomies(draftFilters);
  const selectedTypes = readSelectedOptions(draftFilters, "type");
  const selectedStatuses = readSelectedOptions(draftFilters, "status");
  const typeSummary = selectedOptionSummary(
    selectedTypes,
    TYPE_OPTIONS,
    "Todos os tipos",
  );
  const statusSummary = selectedOptionSummary(
    selectedStatuses,
    STATUS_OPTIONS,
    "Todos os status",
  );

  useEffect(() => {
    if (!draftFilters.from && !draftFilters.to) setSelectedDatePeriod("custom");
  }, [draftFilters.from, draftFilters.to]);

  function selectDatePeriod(period) {
    setSelectedDatePeriod(period.value);
    const range = datePeriodRange(period);
    onChange("from", range.from);
    onChange("to", range.to);
  }

  return (
    <section className="issueFiltersPanel contentBand" id={id}>
      <div className="issueFiltersBox">
        <form className="filterGrid" onSubmit={onSubmit}>
          <label className="field filterCode">
            <span>Código</span>
            <input
              value={draftFilters.codigo}
              onChange={(event) => onChange("codigo", event.target.value)}
              placeholder="INC, REQ ou ID"
            />
          </label>

          <label className="field filterText">
            <span>
              <Search size={14} />
              Texto
            </span>
            <input
              value={draftFilters.texto}
              onChange={(event) => onChange("texto", event.target.value)}
              placeholder="Título, descrição, origem ou anexo"
            />
          </label>

          <div className="field filterDatePeriod">
            <span>
              <CalendarDays size={14} />
              Período
            </span>
            <div
              aria-label="Período do filtro de data"
              className="datePeriodOptions"
              role="group"
            >
              {DATE_PERIOD_PRESETS.map((period) => (
                <button
                  aria-label={period.title}
                  aria-pressed={selectedDatePeriod === period.value}
                  className={
                    selectedDatePeriod === period.value
                      ? "datePeriodOption activeDatePeriodOption"
                      : "datePeriodOption"
                  }
                  key={period.value}
                  onClick={() => selectDatePeriod(period)}
                  title={period.title}
                  type="button"
                >
                  {period.label}
                </button>
              ))}
              <button
                aria-label="Selecionar campo de data e período personalizado"
                aria-pressed={selectedDatePeriod === "custom"}
                className={
                  selectedDatePeriod === "custom"
                    ? "datePeriodOption activeDatePeriodOption"
                    : "datePeriodOption"
                }
                onClick={() => setSelectedDatePeriod("custom")}
                title="Período personalizado"
                type="button"
              >
                ...
              </button>
            </div>
          </div>

          {selectedDatePeriod === "custom" ? (
            <>
              <label className="field filterDateField">
                <span>Campo de data</span>
                <select
                  value={draftFilters.dateField}
                  onChange={(event) =>
                    onChange("dateField", event.target.value)
                  }
                >
                  {DATE_FIELDS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field filterFrom">
                <span>De</span>
                <input
                  type="date"
                  value={draftFilters.from}
                  onChange={(event) => onChange("from", event.target.value)}
                />
              </label>

              <label className="field filterTo">
                <span>Até</span>
                <input
                  type="date"
                  value={draftFilters.to}
                  onChange={(event) => onChange("to", event.target.value)}
                />
              </label>
            </>
          ) : null}

          {applications.length ? (
            <CatalogFilterFields
              applicationId={draftFilters.applicationId}
              applications={applications}
              componentId={draftFilters.componentId}
              components={components}
              onChange={onChange}
            />
          ) : null}

          <FilterDialogButton
            count={selectedTypes.length}
            icon={ClipboardList}
            label="Tipos"
            onClick={() => setOptionDialogOpen("type")}
            summary={typeSummary}
          />

          <FilterDialogButton
            count={selectedStatuses.length}
            icon={ListChecks}
            label="Status"
            onClick={() => setOptionDialogOpen("status")}
            summary={statusSummary}
          />
          {tagGroups.length ? (
            <FilterDialogButton
              count={selectedTagCount}
              icon={Tags}
              label="Tags"
              onClick={() => setTagsDialogOpen(true)}
              summary={
                selectedTagCount
                  ? `${selectedTagCount} selecionada(s)`
                  : "Todas as tags"
              }
            />
          ) : null}

          {taxonomyPackage?.taxonomy?.length ? (
            <FilterDialogButton
              count={selectedTaxonomies.length}
              icon={FolderTree}
              label="Classificações"
              onClick={() => setTaxonomyDialogOpen(true)}
              summary={
                selectedTaxonomies.length
                  ? `${selectedTaxonomies.length} selecionada(s)`
                  : "Todas as classificações"
              }
            />
          ) : null}

          <div className="filterFooter">
            <div className="filterActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={onClear}
              >
                Limpar
              </button>
              <button className="primaryButton" type="submit">
                <Filter size={16} />
                Buscar
              </button>
            </div>
          </div>
        </form>
      </div>

      <IssueFilterDialogs
        draftFilters={draftFilters}
        onChange={onChange}
        optionDialogOpen={optionDialogOpen}
        selectedTagCount={selectedTagCount}
        selectedTaxonomies={selectedTaxonomies}
        setOptionDialogOpen={setOptionDialogOpen}
        setTagsDialogOpen={setTagsDialogOpen}
        setTaxonomyDialogOpen={setTaxonomyDialogOpen}
        tagGroups={tagGroups}
        tagsDialogOpen={tagsDialogOpen}
        taxonomyDialogOpen={taxonomyDialogOpen}
        taxonomyPackage={taxonomyPackage}
      />
    </section>
  );
}

function selectedOptionSummary(selectedValues, options, emptyLabel) {
  if (!selectedValues.length) return emptyLabel;
  const selectedLabels = selectedValues
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter(Boolean);
  if (selectedLabels.length === 1) return selectedLabels[0];
  return `${selectedValues.length} selecionados`;
}

function IssueFilterDialogs({
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
                      const checked = readSelectedTags(
                        draftFilters,
                        group.id,
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
                            onChange={() =>
                              toggleSelectedTag(
                                draftFilters,
                                group.id,
                                tagId,
                                onChange,
                              )
                            }
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

            <footer>
              {selectedTagCount ? (
                <button
                  className="secondaryButton clearDialogSelectionButton"
                  onClick={() =>
                    tagGroups.forEach((group) =>
                      onChange(`tag_${group.id}`, ""),
                    )
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
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setTaxonomyDialogOpen(false);
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
      ) : null}
    </>
  );
}
