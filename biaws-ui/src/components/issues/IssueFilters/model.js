function readSelection(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const DATE_PERIOD_PRESETS = [
  { value: "1w", label: "1s", title: "Última semana", days: 7 },
  { value: "15d", label: "15d", title: "Última quinzena", days: 15 },
  { value: "1m", label: "1m", title: "Último mês", months: 1 },
  { value: "3m", label: "3m", title: "Últimos 3 meses", months: 3 },
  { value: "6m", label: "6m", title: "Últimos 6 meses", months: 6 },
  { value: "12m", label: "12m", title: "Últimos 12 meses", months: 12 },
];

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function datePeriodRange({ days, months }, today = new Date()) {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (days) {
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    return { from: formatDateInput(from), to: formatDateInput(to) };
  }

  const targetMonth = today.getMonth() - months;
  const lastTargetDay = new Date(
    today.getFullYear(),
    targetMonth + 1,
    0,
  ).getDate();
  const from = new Date(
    today.getFullYear(),
    targetMonth,
    Math.min(today.getDate(), lastTargetDay),
  );

  return { from: formatDateInput(from), to: formatDateInput(to) };
}

export function matchingDatePeriod(filters, today = new Date()) {
  return (
    DATE_PERIOD_PRESETS.find((period) => {
      const range = datePeriodRange(period, today);
      return filters.from === range.from && filters.to === range.to;
    })?.value || "custom"
  );
}

export function readSelectedTags(draftFilters, groupId) {
  return readSelection(draftFilters[`tag_${groupId}`]);
}

export function toggleSelectedTag(draftFilters, groupId, tagId, onChange) {
  const selectedTags = readSelectedTags(draftFilters, groupId);
  const nextTags = selectedTags.includes(tagId)
    ? selectedTags.filter((selectedTag) => selectedTag !== tagId)
    : [...selectedTags, tagId];
  onChange(`tag_${groupId}`, nextTags.join(","));
}

export function countSelectedTags(draftFilters, tagGroups) {
  return tagGroups.reduce(
    (total, group) => total + readSelectedTags(draftFilters, group.id).length,
    0,
  );
}

export function readSelectedTaxonomies(draftFilters) {
  return readSelection(draftFilters.taxonomy);
}

export function readSelectedOptions(draftFilters, field) {
  return readSelection(draftFilters[field]);
}

export function toggleSelectedOption(draftFilters, field, value, onChange) {
  const selected = readSelectedOptions(draftFilters, field);
  const next = selected.includes(value)
    ? selected.filter((selectedValue) => selectedValue !== value)
    : [...selected, value];
  onChange(field, next.join(","));
}
