import { useRef, useState } from "react";

import { importEml } from "../../../../api.js";
import { TYPE_OPTIONS } from "../../../../constants/issues.js";
import { canClassifyContext, isValidEmlEntry } from "../../ImportEmlItem.jsx";
import {
  cloneEmlClassification,
  contextFromPreviewIssue,
  mergeEmlClassificationSection,
  selectedEmlTaxonomyIds,
  shouldRetryContextDiscovery,
} from "../model.js";

const EMPTY_CLASSIFICATION = {
  primaryTaxonomyId: "",
  secondaryTaxonomyIds: [],
  summary: "",
  tags: {},
};

export function useImportEmlDialog({
  applications,
  classificationScope,
  onImported,
  workspace,
}) {
  const [entries, setEntries] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [sanitizationOpen, setSanitizationOpen] = useState(false);
  const [contextEntryKey, setContextEntryKey] = useState("");
  const [contextDraft, setContextDraft] = useState({
    applicationId: "",
    affectedComponentIds: [],
  });
  const [classificationEntryKey, setClassificationEntryKey] = useState("");
  const [classificationSection, setClassificationSection] =
    useState("taxonomy");
  const [classificationDraft, setClassificationDraft] =
    useState(EMPTY_CLASSIFICATION);
  const inputRef = useRef(null);
  const typeOptions = TYPE_OPTIONS.filter((option) => option.value);
  const defaultType = typeOptions[0]?.value || "";

  function updateEntry(key, patch) {
    setEntries((current) =>
      current.map((entry) =>
        entry.key === key ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function updateOverride(key, field, value) {
    setEntries((current) =>
      current.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              overrides: { ...entry.overrides, [field]: value },
              preview: entry.preview
                ? {
                    ...entry.preview,
                    issue: { ...entry.preview.issue, [field]: value },
                  }
                : entry.preview,
            }
          : entry,
      ),
    );
  }

  function requestEntryPreview(
    entry,
    overrides,
    entryContext,
    discoverContext,
  ) {
    return importEml(entry.file, {
      dryRun: true,
      ...(discoverContext
        ? {}
        : { workspaceId: workspace?.id, ...(entryContext || {}) }),
      ...(entry.classification ? { classification: entry.classification } : {}),
      ...(overrides || {}),
    });
  }

  async function analyzeEntry(
    entry,
    overrides = null,
    entryContext = entry.context,
    discoverContext = false,
  ) {
    updateEntry(entry.key, { status: "analyzing", error: "" });
    try {
      let resolvedContext = entryContext;
      let preview;
      try {
        preview = await requestEntryPreview(
          entry,
          overrides,
          entryContext,
          discoverContext,
        );
      } catch (error) {
        if (
          !shouldRetryContextDiscovery(error, discoverContext, entry.context)
        ) {
          throw error;
        }
        resolvedContext = entry.context;
        preview = await requestEntryPreview(
          entry,
          overrides,
          resolvedContext,
          false,
        );
      }
      if (discoverContext && !resolvedContext) {
        resolvedContext = contextFromPreviewIssue(preview.issue, entry.context);
      }
      updateEntry(entry.key, {
        preview,
        context: resolvedContext || entry.context,
        overrides: overrides || {
          id: preview.issue.id || "",
          type: preview.issue.type || defaultType,
          title: preview.issue.title || "",
        },
        status: "ready",
        error: "",
      });
    } catch (error) {
      updateEntry(entry.key, { status: "error", error: error.message });
    }
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((file) =>
      file.name.toLowerCase().endsWith(".eml"),
    );
    const additions = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      context: {
        applicationId: applications[0]?.id || "",
        affectedComponentIds: [],
      },
      classification: null,
      status: "analyzing",
      preview: null,
      overrides: null,
      error: "",
    }));
    setEntries((current) => [...current, ...additions]);
    for (const entry of additions) {
      await analyzeEntry(entry, null, null, true);
    }
  }

  async function importEntry(entry) {
    updateEntry(entry.key, { status: "importing", error: "" });
    try {
      const result = await importEml(entry.file, {
        workspaceId: workspace?.id,
        ...entry.context,
        ...(entry.classification
          ? { classification: entry.classification }
          : {}),
        ...(entry.overrides || {}),
      });
      updateEntry(entry.key, { result, status: "done" });
      onImported?.(result);
    } catch (error) {
      updateEntry(entry.key, { status: "error", error: error.message });
    }
  }

  async function importReady() {
    for (const entry of entries.filter(
      (item) => item.status === "ready" && isValidEmlEntry(item),
    )) {
      await importEntry(entry);
    }
  }

  async function handleSanitizationSaved() {
    for (const entry of entries.filter((item) => item.status !== "done")) {
      await analyzeEntry(entry, entry.overrides);
    }
  }

  function openContextDialog(entry) {
    setContextEntryKey(entry.key);
    setContextDraft(entry.context);
  }

  async function applyContextToEntries(applyToAll) {
    const targets = entries.filter(
      (entry) =>
        entry.status !== "done" &&
        (applyToAll || entry.key === contextEntryKey),
    );
    const nextContext = {
      applicationId: contextDraft.applicationId,
      affectedComponentIds: [...contextDraft.affectedComponentIds],
    };
    setContextEntryKey("");
    for (const entry of targets) {
      const updatedEntry = { ...entry, context: nextContext };
      updateEntry(entry.key, { context: nextContext });
      await analyzeEntry(updatedEntry, entry.overrides, nextContext);
    }
  }

  function openClassificationDialog(entry, section) {
    setClassificationEntryKey(entry.key);
    setClassificationSection(section);
    setClassificationDraft(
      cloneEmlClassification(
        entry.classification || entry.preview?.issue?.classification,
      ),
    );
  }

  function updateTaxonomies(taxonomyIds) {
    setClassificationDraft((current) => {
      const primaryTaxonomyId = taxonomyIds.includes(current.primaryTaxonomyId)
        ? current.primaryTaxonomyId
        : taxonomyIds[0] || "";
      return {
        ...current,
        primaryTaxonomyId,
        secondaryTaxonomyIds: taxonomyIds.filter(
          (taxonomyId) => taxonomyId !== primaryTaxonomyId,
        ),
      };
    });
  }

  function updatePrimaryTaxonomy(primaryTaxonomyId) {
    setClassificationDraft((current) => ({
      ...current,
      primaryTaxonomyId,
      secondaryTaxonomyIds: selectedEmlTaxonomyIds(current).filter(
        (taxonomyId) => taxonomyId !== primaryTaxonomyId,
      ),
    }));
  }

  function toggleTag(groupId, tagId) {
    setClassificationDraft((current) => {
      const selectedTags = current.tags[groupId] || [];
      return {
        ...current,
        tags: {
          ...current.tags,
          [groupId]: selectedTags.includes(tagId)
            ? selectedTags.filter((selectedTag) => selectedTag !== tagId)
            : [...selectedTags, tagId],
        },
      };
    });
  }

  async function applyClassificationToEntries(applyToAll) {
    const targets = entries.filter(
      (entry) =>
        entry.status !== "done" &&
        canClassifyContext(entry.context, classificationScope) &&
        (applyToAll || entry.key === classificationEntryKey),
    );
    setClassificationEntryKey("");
    for (const entry of targets) {
      const currentClassification = cloneEmlClassification(
        entry.classification || entry.preview?.issue?.classification,
      );
      const nextClassification = mergeEmlClassificationSection(
        currentClassification,
        classificationDraft,
        classificationSection,
      );
      const updatedEntry = { ...entry, classification: nextClassification };
      updateEntry(entry.key, { classification: nextClassification });
      await analyzeEntry(updatedEntry, entry.overrides);
    }
  }

  const busy = entries.some((entry) =>
    ["analyzing", "importing"].includes(entry.status),
  );
  const readyCount = entries.filter(
    (entry) => entry.status === "ready" && isValidEmlEntry(entry),
  ).length;

  return {
    addFiles,
    analyzeEntry,
    applyClassificationToEntries,
    applyContextToEntries,
    busy,
    classificationDraft,
    classificationEntry: entries.find(
      (entry) => entry.key === classificationEntryKey,
    ),
    classificationSection,
    contextDraft,
    contextEntry: entries.find((entry) => entry.key === contextEntryKey),
    defaultType,
    dragging,
    entries,
    handleSanitizationSaved,
    importEntry,
    importReady,
    inputRef,
    openClassificationDialog,
    openContextDialog,
    readyCount,
    removeEntry: (entryKey) =>
      setEntries((current) => current.filter((item) => item.key !== entryKey)),
    sanitizationApplicationId:
      entries.find((entry) => entry.status !== "done")?.context.applicationId ||
      applications[0]?.id ||
      "",
    sanitizationOpen,
    setClassificationEntryKey,
    setContextDraft,
    setContextEntryKey,
    setDragging,
    setSanitizationOpen,
    toggleTag,
    typeOptions,
    updateOverride,
    updatePrimaryTaxonomy,
    updateTaxonomies,
  };
}
