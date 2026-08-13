import { useEffect, useState } from "react";

import { STATUS_OPTIONS, TYPE_OPTIONS } from "../../../constants/issues.js";
import { IssueFilterDialogs } from "./components/IssueFilterDialogs.jsx";
import { IssueFilterForm } from "./components/IssueFilterForm.jsx";
import {
  countSelectedTags,
  datePeriodRange,
  matchingDatePeriod,
  readSelectedOptions,
  readSelectedTaxonomies,
  selectedOptionSummary,
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
      <IssueFilterForm
        applications={applications}
        components={components}
        draftFilters={draftFilters}
        onChange={onChange}
        onClear={onClear}
        onSubmit={onSubmit}
        openOptionDialog={setOptionDialogOpen}
        selectedDatePeriod={selectedDatePeriod}
        selectedStatuses={selectedStatuses}
        selectedTagCount={selectedTagCount}
        selectedTaxonomies={selectedTaxonomies}
        selectedTypes={selectedTypes}
        selectDatePeriod={selectDatePeriod}
        setSelectedDatePeriod={setSelectedDatePeriod}
        setTagsDialogOpen={setTagsDialogOpen}
        setTaxonomyDialogOpen={setTaxonomyDialogOpen}
        statusSummary={statusSummary}
        tagGroups={tagGroups}
        taxonomyPackage={taxonomyPackage}
        typeSummary={typeSummary}
      />
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
