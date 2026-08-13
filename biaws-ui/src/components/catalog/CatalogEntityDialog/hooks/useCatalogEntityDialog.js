import { useEffect, useState } from "react";

import { fetchDocument } from "../../../../api.js";
import { buildUrl } from "../../../../api/client.js";
import {
  appendPublicationDraft,
  catalogEntityDraft,
  catalogEntityPayload,
  monitoringSignalCurl,
  runtimeMonitoringPath,
} from "../model.js";
import { EMPTY_PUBLICATION_DRAFT } from "../constants.js";
import {
  monitoringCliExample,
  useRuntimeMonitoring,
} from "../../../monitoring/runtime/index.js";

function runtimeSignalUrl(runtimePath) {
  if (!runtimePath) return "";
  return buildUrl(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimePath)}/signals`,
  ).toString();
}

export function useCatalogEntityDialog({
  entity,
  kind,
  onArchive,
  onClose,
  onSave,
  options,
}) {
  const editing = Boolean(entity?.id);
  const [draft, setDraft] = useState(() => catalogEntityDraft(kind, entity));
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("basic");
  const [publicationDraft, setPublicationDraft] = useState(
    EMPTY_PUBLICATION_DRAFT,
  );
  const [documentSelectorOpen, setDocumentSelectorOpen] = useState(false);
  const [relatedDocuments, setRelatedDocuments] = useState([]);
  const [relatedDocumentsLoading, setRelatedDocumentsLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const runtimeDeployment = (options.deployments || []).find(
    ({ id }) => id === entity?.deploymentId,
  );
  const runtimeComponent = (options.components || []).find(
    ({ id }) => id === (entity?.componentId || runtimeDeployment?.componentId),
  );
  const runtimePath = runtimeMonitoringPath({
    application: options.application,
    component: runtimeComponent,
    deployment: runtimeDeployment,
    runtime: entity,
  });
  const curlExample = monitoringSignalCurl({
    apiUrl: runtimeSignalUrl(runtimePath),
    runtimeReference: runtimePath,
    workspaceId: options.workspace?.id,
  });
  const cliExample = monitoringCliExample({
    runtimeReference: runtimePath,
    workspaceId: options.workspace?.id,
  });
  const runtimeMonitoring = useRuntimeMonitoring({ editing, entity, kind });

  const relatedDocumentIds = (draft.documentLinks || [])
    .map(({ documentId }) => documentId)
    .join(",");

  useEffect(() => {
    if (kind !== "runtime" || !options.canReadDocuments) return undefined;
    const documentIds = relatedDocumentIds.split(",").filter(Boolean);
    if (!documentIds.length) {
      setRelatedDocuments([]);
      setRelatedDocumentsLoading(false);
      return undefined;
    }
    let active = true;
    setRelatedDocumentsLoading(true);
    Promise.allSettled(documentIds.map((id) => fetchDocument(id)))
      .then((results) => {
        if (!active) return;
        setRelatedDocuments(
          results.map((result, index) =>
            result.status === "fulfilled"
              ? result.value.document
              : {
                  id: documentIds[index],
                  title: documentIds[index],
                  loadError: result.reason?.message || "Falha ao carregar",
                },
          ),
        );
      })
      .finally(() => {
        if (active) setRelatedDocumentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, options.canReadDocuments, relatedDocumentIds]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateDocumentPurpose(documentId, purpose) {
    update(
      "documentLinks",
      (draft.documentLinks || []).map((link) =>
        link.documentId === documentId ? { ...link, purpose } : link,
      ),
    );
  }

  function addPublication() {
    if (!publicationDraft.version.trim()) return;
    setDraft((current) => appendPublicationDraft(current, publicationDraft));
    setPublicationDraft(EMPTY_PUBLICATION_DRAFT);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const draftToSave =
        kind === "deployment"
          ? appendPublicationDraft(draft, publicationDraft)
          : draft;
      await onSave(catalogEntityPayload(kind, draftToSave, editing));
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!onArchive) return;
    setArchiving(true);
    setError("");
    try {
      const archived = await onArchive();
      if (archived) onClose();
    } catch (archiveError) {
      setError(archiveError.message);
    } finally {
      setArchiving(false);
    }
  }

  function confirmDocuments(documentIds) {
    const currentLinks = new Map(
      (draft.documentLinks || []).map((link) => [link.documentId, link]),
    );
    update(
      "documentLinks",
      documentIds.map(
        (documentId) =>
          currentLinks.get(documentId) || {
            documentId,
            purpose: "reference",
          },
      ),
    );
    setDocumentSelectorOpen(false);
  }

  return {
    activeSection,
    addPublication,
    archive,
    archiving,
    cliExample,
    confirmDocuments,
    curlExample,
    documentSelectorOpen,
    draft,
    editing,
    entity,
    error,
    publicationDraft,
    relatedDocuments,
    relatedDocumentsLoading,
    runtimeComponent,
    runtimePath,
    saving,
    selectedDocument,
    setActiveSection,
    setDocumentSelectorOpen,
    setPublicationDraft,
    setSelectedDocument,
    submit,
    update,
    updateDocumentPurpose,
    ...runtimeMonitoring,
  };
}
