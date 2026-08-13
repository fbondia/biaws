import {
  CalendarDays,
  ClipboardList,
  Filter,
  FolderTree,
  ListChecks,
  Search,
  Tags,
} from "lucide-react";

import { DATE_FIELDS } from "../../../../constants/issues.js";
import { CatalogFilterFields } from "../../../catalog/CatalogContextFields/index.jsx";
import { FilterDialogButton } from "../../../shared/FilterDialogButton.jsx";
import { DATE_PERIOD_PRESETS } from "../model.js";

export function IssueFilterForm({
  applications,
  components,
  draftFilters,
  onChange,
  onClear,
  onSubmit,
  openOptionDialog,
  selectedDatePeriod,
  selectedStatuses,
  selectedTagCount,
  selectedTaxonomies,
  selectedTypes,
  selectDatePeriod,
  setSelectedDatePeriod,
  setTagsDialogOpen,
  setTaxonomyDialogOpen,
  statusSummary,
  tagGroups,
  taxonomyPackage,
  typeSummary,
}) {
  return (
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
          <CustomDateFields draftFilters={draftFilters} onChange={onChange} />
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
          onClick={() => openOptionDialog("type")}
          summary={typeSummary}
        />
        <FilterDialogButton
          count={selectedStatuses.length}
          icon={ListChecks}
          label="Status"
          onClick={() => openOptionDialog("status")}
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
            <button className="secondaryButton" type="button" onClick={onClear}>
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
  );
}

function CustomDateFields({ draftFilters, onChange }) {
  return (
    <>
      <label className="field filterDateField">
        <span>Campo de data</span>
        <select
          value={draftFilters.dateField}
          onChange={(event) => onChange("dateField", event.target.value)}
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
  );
}
