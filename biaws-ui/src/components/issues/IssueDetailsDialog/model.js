export function reconcileClassificationDraft(draft, previous, saved) {
  return Object.fromEntries(
    Object.keys(saved).map((field) => [
      field,
      JSON.stringify(draft[field]) === JSON.stringify(previous[field]) ? saved[field] : draft[field],
    ]),
  );
}
