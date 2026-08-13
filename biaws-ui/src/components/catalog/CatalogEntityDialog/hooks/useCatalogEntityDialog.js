import { useEffect, useState } from "react";

import {
  createRuntimeManualMonitoringObservation,
  fetchDocument,
  fetchRuntimeMonitoringTimeline,
} from "../../../../api.js";
import { buildUrl } from "../../../../api/client.js";
import {
  appendPublicationDraft,
  catalogEntityDraft,
  catalogEntityPayload,
  monitoringSignalCurl,
  runtimeMonitoringPath,
} from "../model.js";
import {
  EMPTY_OBSERVATION_DRAFT,
  EMPTY_PUBLICATION_DRAFT,
} from "../constants.js";

function runtimeSignalUrl(runtimePath) {
  if (!runtimePath) return "";
  return buildUrl(
    `/api/monitoring/runtimes/${encodeURIComponent(runtimePath)}/signals`,
  ).toString();
}

export function useCatalogEntityDialog({
  entity,
  kind,
  onClose,
  onSave,
  options,
}) {
  const editing = Boolean(entity?.id);
  const [draft, setDraft] = useState(() => catalogEntityDraft(kind, entity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("basic");
  const [publicationDraft, setPublicationDraft] = useState(
    EMPTY_PUBLICATION_DRAFT,
  );
  const [observationDraft, setObservationDraft] = useState(
    EMPTY_OBSERVATION_DRAFT,
  );
  const [monitoringEvents, setMonitoringEvents] = useState([]);
  const [monitoringError, setMonitoringError] = useState("");
  const [addingObservation, setAddingObservation] = useState(false);
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

  useEffect(() => {
    if (kind !== "runtime" || !entity?.id) return undefined;
    let active = true;
    fetchRuntimeMonitoringTimeline(entity.id, { limit: 100 })
      .then((payload) => {
        if (active) setMonitoringEvents(payload.items || []);
      })
      .catch((loadError) => {
        if (active) setMonitoringError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [entity?.id, kind]);

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

  async function addObservation() {
    if (!entity?.id || !observationDraft.observedAt) return;
    setAddingObservation(true);
    setMonitoringError("");
    try {
      const result = await createRuntimeManualMonitoringObservation(entity.id, {
        status: observationDraft.healthStatus,
        observedAt: new Date(observationDraft.observedAt).toISOString(),
        source: observationDraft.source.trim(),
        message: observationDraft.message.trim(),
        metadata: {},
      });
      setMonitoringEvents((current) =>
        [result.signal, ...current].sort(
          (left, right) =>
            new Date(right.observedAt) - new Date(left.observedAt),
        ),
      );
      setObservationDraft(EMPTY_OBSERVATION_DRAFT);
    } catch (addError) {
      setMonitoringError(addError.message);
    } finally {
      setAddingObservation(false);
    }
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
    addObservation,
    addPublication,
    addingObservation,
    confirmDocuments,
    curlExample,
    documentSelectorOpen,
    draft,
    editing,
    error,
    monitoringError,
    monitoringEvents,
    observationDraft,
    publicationDraft,
    relatedDocuments,
    relatedDocumentsLoading,
    runtimeComponent,
    runtimePath,
    saving,
    selectedDocument,
    setActiveSection,
    setDocumentSelectorOpen,
    setObservationDraft,
    setPublicationDraft,
    setSelectedDocument,
    submit,
    update,
    updateDocumentPurpose,
  };
}
