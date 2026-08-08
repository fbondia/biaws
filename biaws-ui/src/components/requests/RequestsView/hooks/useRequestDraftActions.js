import {
  createDefaultSpecificationSection,
  createSpecificationSection,
  normalizeRequest,
  normalizeSpecification,
  normalizeSpecificationSectionTitle,
  REQUEST_SPECIFICATION_SECTION_TITLES,
} from "../../requestUtils.js";

export function useRequestDraftActions({
  numberDrafts,
  schedulePersistRequest,
  selectedRequest,
  setChecklistDialogLabel,
  setNumberDrafts,
  setRequestError,
  updateRequest,
  updateSelectedField,
}) {
  function numberDraftKey(field) {
    return `${selectedRequest?.id || "none"}:${field}`;
  }

  function beginNumberDraft(field, value) {
    const key = numberDraftKey(field);
    setNumberDrafts((current) => ({
      ...current,
      [key]: String(value ?? 0),
    }));
  }

  function updateNumberDraft(field, value) {
    const key = numberDraftKey(field);
    setNumberDrafts((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function clearNumberDraft(field) {
    const key = numberDraftKey(field);
    setNumberDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function readDraftedNumber(field, value) {
    const key = numberDraftKey(field);
    return Object.hasOwn(numberDrafts, key) ? numberDrafts[key] : value;
  }

  function commitEstimatedJourneys(rawValue) {
    const value = rawValue === "" ? 0 : Number(rawValue);
    clearNumberDraft("estimatedJourneys");

    if (!Number.isFinite(value) || value < 0) {
      setRequestError(
        "Jornadas estimadas deve ser um número maior ou igual a zero.",
      );
      return;
    }

    updateSelectedField("estimatedJourneys", value);
  }

  function updateChecklistItem(label, field, value) {
    if (!selectedRequest) return;

    const nextRequest = normalizeRequest({
      ...selectedRequest,
      checklist: selectedRequest.checklist.map((item) =>
        item.label === label
          ? { ...item, [field]: field === "done" ? Boolean(value) : value }
          : item,
      ),
    });
    updateRequest(selectedRequest.id, () => nextRequest);

    schedulePersistRequest(nextRequest);
  }

  function toggleChecklistItem(item) {
    updateChecklistItem(item.label, "done", !item.done);
    setChecklistDialogLabel(item.label);
  }

  function removeChecklistItem(label) {
    if (!selectedRequest) return;

    const nextRequest = normalizeRequest({
      ...selectedRequest,
      checklist: selectedRequest.checklist.filter(
        (item) => item.label !== label,
      ),
    });
    updateRequest(selectedRequest.id, () => nextRequest);
    setChecklistDialogLabel("");
    schedulePersistRequest(nextRequest);
  }

  function updateJourneyMonth(month, field, value) {
    if (!selectedRequest) return;

    const nextRequest = normalizeRequest({
      ...selectedRequest,
      journeys: selectedRequest.journeys.map((item) =>
        item.month === month ? { ...item, [field]: Number(value) || 0 } : item,
      ),
    });
    updateRequest(selectedRequest.id, () => nextRequest);

    schedulePersistRequest(nextRequest);
  }

  function updateJourneyComment(month, comment) {
    if (!selectedRequest) return;

    const nextRequest = normalizeRequest({
      ...selectedRequest,
      journeys: selectedRequest.journeys.map((item) =>
        item.month === month ? { ...item, comment } : item,
      ),
    });
    updateRequest(selectedRequest.id, () => nextRequest);

    schedulePersistRequest(nextRequest);
  }

  function updateSpecification(sections) {
    if (!selectedRequest) return;

    const nextRequest = normalizeRequest({
      ...selectedRequest,
      specification: normalizeSpecification({
        sections: sections.map((section, index) => ({
          ...section,
          order: index,
        })),
      }),
    });
    updateRequest(selectedRequest.id, () => nextRequest);

    schedulePersistRequest(nextRequest);
  }

  function updateSpecificationSection(sectionId, field, value) {
    const sections = selectedRequest?.specification?.sections || [];
    updateSpecification(
      sections.map((section) =>
        section.id === sectionId ? { ...section, [field]: value } : section,
      ),
    );
  }

  function addSpecificationSection() {
    const sections = selectedRequest?.specification?.sections || [];
    updateSpecification([...sections, createSpecificationSection()]);
  }

  function addMissingSpecificationSections() {
    const sections = selectedRequest?.specification?.sections || [];
    const existingTitles = new Set(
      sections.map((section) =>
        normalizeSpecificationSectionTitle(section.title),
      ),
    );
    const missingSections = REQUEST_SPECIFICATION_SECTION_TITLES.filter(
      (title) => !existingTitles.has(normalizeSpecificationSectionTitle(title)),
    ).map(createDefaultSpecificationSection);

    if (!missingSections.length) return;

    updateSpecification([...sections, ...missingSections]);
  }

  function removeSpecificationSection(sectionId) {
    const sections = selectedRequest?.specification?.sections || [];
    updateSpecification(sections.filter((section) => section.id !== sectionId));
  }

  function moveSpecificationSection(sectionId, direction) {
    const sections = [...(selectedRequest?.specification?.sections || [])];
    const currentIndex = sections.findIndex(
      (section) => section.id === sectionId,
    );
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length)
      return;

    const [section] = sections.splice(currentIndex, 1);
    sections.splice(nextIndex, 0, section);
    updateSpecification(sections);
  }

  function commitJourneyMonth(month, field, rawValue) {
    const value = rawValue === "" ? 0 : Number(rawValue);
    clearNumberDraft(`journeys:${field}:${month}`);

    if (!Number.isFinite(value) || value < 0) {
      setRequestError(
        "Jornadas do mês deve ser um número maior ou igual a zero.",
      );
      return;
    }

    updateJourneyMonth(month, field, value);
  }

  return {
    addMissingSpecificationSections,
    addSpecificationSection,
    beginNumberDraft,
    clearNumberDraft,
    commitJourneyMonth,
    commitEstimatedJourneys,
    moveSpecificationSection,
    readDraftedNumber,
    removeSpecificationSection,
    removeChecklistItem,
    toggleChecklistItem,
    updateJourneyComment,
    updateChecklistItem,
    updateNumberDraft,
    updateSpecificationSection,
  };
}
