function readSelection(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
