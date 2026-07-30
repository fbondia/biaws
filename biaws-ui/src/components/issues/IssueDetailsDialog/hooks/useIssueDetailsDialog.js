import { ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchIssueTaxonomy,
  saveIssueClassification,
  saveIssueTaxonomy,
  updateIssue,
} from "../../../../api.js";
import {
  ALL_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from "../../../../constants/issues.js";
import {
  appendTaxonomyNode,
  buildTaxonomyById,
  buildUniqueTaxonomyId,
  EMPTY_CLASSIFICATION,
  flattenTaxonomy,
  getSelectedTagEntries,
  ISSUE_TYPE_ICONS,
  normalizeClassification,
  optionLabel,
  selectedTaxonomyIds,
  serializeClassification,
  updateTaxonomyNodeLabel,
} from "../components/ClassificationControls.jsx";

export function useIssueDetailsDialog({
  details,
  onClose,
  onIssueUpdated,
  preview,
}) {
  const baseIssue = details?.issue || preview || {};
  const [activeTab, setActiveTab] = useState("description");
  const [activeTagGroupId, setActiveTagGroupId] = useState("");
  const [taxonomyPackage, setTaxonomyPackage] = useState(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState("");
  const [classificationDraft, setClassificationDraft] =
    useState(EMPTY_CLASSIFICATION);
  const [savedClassification, setSavedClassification] = useState(null);
  const [savingClassification, setSavingClassification] = useState(false);
  const [classificationMessage, setClassificationMessage] = useState("");
  const [savingTaxonomyCatalog, setSavingTaxonomyCatalog] = useState(false);
  const [contextDraft, setContextDraft] = useState({
    applicationId: baseIssue.applicationId || "",
    affectedComponentIds: baseIssue.affectedComponentIds || [],
  });
  const [savingContext, setSavingContext] = useState(false);
  const [contextError, setContextError] = useState("");

  const issue = {
    ...baseIssue,
    classification: savedClassification || baseIssue.classification,
  };
  const comments = details?.comments || [];
  const attachments = issue.attachments || [];
  const flatTaxonomy = useMemo(
    () => flattenTaxonomy(taxonomyPackage?.taxonomy || []),
    [taxonomyPackage],
  );
  const taxonomyById = useMemo(
    () => buildTaxonomyById(flatTaxonomy),
    [flatTaxonomy],
  );
  const persistedClassification = useMemo(
    () => normalizeClassification(issue.classification),
    [issue.classification],
  );
  const selectedTagEntries = useMemo(
    () =>
      getSelectedTagEntries(
        persistedClassification,
        taxonomyPackage?.tagGroups || [],
      ),
    [persistedClassification, taxonomyPackage],
  );
  const draftSelectedTagEntries = useMemo(
    () =>
      getSelectedTagEntries(
        classificationDraft,
        taxonomyPackage?.tagGroups || [],
      ),
    [classificationDraft, taxonomyPackage],
  );
  const selectedTaxonomies = useMemo(
    () => selectedTaxonomyIds(classificationDraft),
    [classificationDraft],
  );
  const activeTagGroup = useMemo(
    () =>
      (taxonomyPackage?.tagGroups || []).find(
        (group) => group.id === activeTagGroupId,
      ),
    [activeTagGroupId, taxonomyPackage],
  );
  const hasClassificationChanges =
    serializeClassification(classificationDraft) !==
    serializeClassification(persistedClassification);

  useEffect(() => {
    setSavedClassification(null);
    setClassificationDraft(normalizeClassification(baseIssue.classification));
    setClassificationMessage("");
  }, [baseIssue.id, baseIssue.classification]);

  useEffect(() => {
    setContextDraft({
      applicationId: baseIssue.applicationId || "",
      affectedComponentIds: baseIssue.affectedComponentIds || [],
    });
    setContextError("");
  }, [baseIssue.id, baseIssue.applicationId, baseIssue.affectedComponentIds]);

  async function saveContext() {
    if (!issue.id || !contextDraft.applicationId) return;
    setSavingContext(true);
    setContextError("");
    try {
      const payload = await updateIssue(issue.id, contextDraft);
      onIssueUpdated?.(payload.issue);
    } catch (saveError) {
      setContextError(saveError.message);
    } finally {
      setSavingContext(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadTaxonomy() {
      setTaxonomyLoading(true);
      setTaxonomyError("");

      try {
        const payload = await fetchIssueTaxonomy();
        if (active) setTaxonomyPackage(payload.taxonomy);
      } catch (loadError) {
        if (active) setTaxonomyError(loadError.message);
      } finally {
        if (active) setTaxonomyLoading(false);
      }
    }

    loadTaxonomy();

    return () => {
      active = false;
    };
  }, []);

  function closeOnBackdrop(event) {
    if (event.target === event.currentTarget) onClose();
  }

  function updateTaxonomies(values) {
    const nextValues = [...new Set(values)];
    setClassificationDraft((current) => {
      const nextPrimary =
        current.primaryTaxonomyId &&
        nextValues.includes(current.primaryTaxonomyId)
          ? current.primaryTaxonomyId
          : nextValues[0] || "";

      return {
        ...current,
        primaryTaxonomyId: nextPrimary,
        secondaryTaxonomyIds: nextValues.filter(
          (taxonomyId) => taxonomyId !== nextPrimary,
        ),
      };
    });
  }

  function updatePrimaryTaxonomy(value) {
    setClassificationDraft((current) => {
      const nextValues = selectedTaxonomyIds(current);
      if (!nextValues.includes(value)) return current;

      return {
        ...current,
        primaryTaxonomyId: value,
        secondaryTaxonomyIds: nextValues.filter(
          (taxonomyId) => taxonomyId !== value,
        ),
      };
    });
  }

  function removeTaxonomy(taxonomyId) {
    updateTaxonomies(
      selectedTaxonomies.filter(
        (selectedTaxonomyId) => selectedTaxonomyId !== taxonomyId,
      ),
    );
  }

  function toggleGroupTag(groupId, tagId) {
    setClassificationDraft((current) => {
      const currentGroupTags = current.tags?.[groupId] || [];
      const exists = currentGroupTags.includes(tagId);

      return {
        ...current,
        tags: {
          ...current.tags,
          [groupId]: exists
            ? currentGroupTags.filter((currentTagId) => currentTagId !== tagId)
            : [...currentGroupTags, tagId],
        },
      };
    });
  }

  function removeGroupTag(groupId, tagId) {
    setClassificationDraft((current) => {
      const currentGroupTags = current.tags?.[groupId] || [];

      return {
        ...current,
        tags: {
          ...current.tags,
          [groupId]: currentGroupTags.filter(
            (currentTagId) => currentTagId !== tagId,
          ),
        },
      };
    });
  }

  function updateKbSummary(value) {
    setClassificationDraft((current) => ({
      ...current,
      summary: value,
    }));
  }

  async function saveClassification() {
    if (!issue.id) return;

    setSavingClassification(true);
    setTaxonomyError("");
    setClassificationMessage("");

    try {
      const payload = await saveIssueClassification(
        issue.id,
        classificationDraft,
      );
      const nextClassification = normalizeClassification(
        payload.issue?.classification,
      );
      setSavedClassification(nextClassification);
      setClassificationDraft(nextClassification);
      onIssueUpdated?.(payload.issue);
      setClassificationMessage("Classificação gravada no MongoDB.");
    } catch (saveError) {
      setTaxonomyError(saveError.message);
    } finally {
      setSavingClassification(false);
    }
  }

  async function addTaxonomyCatalogNode(parentId, label) {
    if (!taxonomyPackage) return null;

    const trimmedLabel = label.trim();
    if (!trimmedLabel) return null;

    setSavingTaxonomyCatalog(true);
    setTaxonomyError("");
    setClassificationMessage("");

    const nextNode = {
      id: buildUniqueTaxonomyId(
        taxonomyPackage.taxonomy || [],
        parentId,
        trimmedLabel,
      ),
      label: trimmedLabel,
    };
    const nextTaxonomyPackage = {
      ...taxonomyPackage,
      taxonomy: appendTaxonomyNode(
        taxonomyPackage.taxonomy || [],
        parentId,
        nextNode,
      ),
    };

    try {
      const payload = await saveIssueTaxonomy(nextTaxonomyPackage);
      setTaxonomyPackage(payload.taxonomy || nextTaxonomyPackage);
      setClassificationMessage("Nó incluído no catálogo de assuntos.");
      return nextNode;
    } catch (saveError) {
      setTaxonomyError(saveError.message);
      return null;
    } finally {
      setSavingTaxonomyCatalog(false);
    }
  }

  async function editTaxonomyCatalogNode(nodeId, label) {
    if (!taxonomyPackage) return null;

    const trimmedLabel = label.trim();
    if (!nodeId || !trimmedLabel) return null;

    setSavingTaxonomyCatalog(true);
    setTaxonomyError("");
    setClassificationMessage("");

    const nextTaxonomyPackage = {
      ...taxonomyPackage,
      taxonomy: updateTaxonomyNodeLabel(
        taxonomyPackage.taxonomy || [],
        nodeId,
        trimmedLabel,
      ),
    };

    try {
      const payload = await saveIssueTaxonomy(nextTaxonomyPackage);
      setTaxonomyPackage(payload.taxonomy || nextTaxonomyPackage);
      setClassificationMessage("Assunto atualizado no catálogo.");
      return { id: nodeId, label: trimmedLabel };
    } catch (saveError) {
      setTaxonomyError(saveError.message);
      return null;
    } finally {
      setSavingTaxonomyCatalog(false);
    }
  }

  const TypeIcon = ISSUE_TYPE_ICONS[issue.type] || ClipboardList;
  const typeLabel = optionLabel(ALL_TYPE_OPTIONS, issue.type);
  const editableStatusOptions = STATUS_OPTIONS.filter((option) => option.value);

  return {
    issue,
    activeTab,
    setActiveTab,
    setActiveTagGroupId,
    taxonomyPackage,
    taxonomyLoading,
    taxonomyError,
    classificationDraft,
    savingClassification,
    classificationMessage,
    savingTaxonomyCatalog,
    contextDraft,
    setContextDraft,
    savingContext,
    contextError,
    comments,
    attachments,
    taxonomyById,
    persistedClassification,
    selectedTagEntries,
    draftSelectedTagEntries,
    selectedTaxonomies,
    activeTagGroup,
    hasClassificationChanges,
    saveContext,
    closeOnBackdrop,
    updateTaxonomies,
    updatePrimaryTaxonomy,
    removeTaxonomy,
    toggleGroupTag,
    removeGroupTag,
    updateKbSummary,
    saveClassification,
    addTaxonomyCatalogNode,
    editTaxonomyCatalogNode,
    TypeIcon,
    typeLabel,
    editableStatusOptions,
  };
}
