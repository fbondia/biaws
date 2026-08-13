import { useEffect, useState } from "react";

import {
  createRequest,
  createRequestNote,
  createRequestTask,
  createRequestTaskNote,
  deleteRequest,
  deleteRequestNote,
  deleteRequestTask,
  deleteRequestTaskNote,
  fetchRequestCollectionItems,
  fetchRequests,
  saveRequestNote,
  saveRequestTask,
  saveRequestTaskNote,
} from "../../../../api.js";
import { hasPermission } from "../../../../permissions.js";
import { useMessages } from "../../../../infrastructure/messages/MessagesProvider.jsx";
import { useCatalogOptions } from "../../../catalog/CatalogContextFields/index.jsx";
import { useRequestCollaborationActions } from "./useRequestCollaborationActions.js";
import { useRequestDerivedState } from "./useRequestDerivedState.js";
import { useRequestDraftActions } from "./useRequestDraftActions.js";
import { useRequestPersistence } from "./useRequestPersistence.js";
import { useRequestReorder } from "./useRequestReorder.js";
import { useRequestSelection } from "./useRequestSelection.js";
import {
  createDefaultSpecificationSection,
  createSpecificationSection,
  normalizeRequest,
  normalizeSpecification,
  normalizeSpecificationSectionTitle,
  newRequest,
  nextTopRequestListRank,
  sortRequestsForList,
} from "../../requestUtils.js";

export function useRequestsView(actor, options = {}) {
  const { collectionId = "", collections = [] } = options;
  const { confirm } = useMessages();
  const [requests, setRequests] = useState([]);
  const [requestCollectionItems, setRequestCollectionItems] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedRequestOverride, setSelectedRequestOverride] = useState(null);
  const [editingRequestId, setEditingRequestId] = useState("");
  const [checklistDialogLabel, setChecklistDialogLabel] = useState("");
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [savingRequestId, setSavingRequestId] = useState("");
  const [numberDrafts, setNumberDrafts] = useState({});
  const [statusFilters, setStatusFilters] = useState([]);
  const [activeDetailTab, setActiveDetailTab] = useState("main");
  const [activeOverviewTab, setActiveOverviewTab] = useState("tasks");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const [requestPage, setRequestPage] = useState(1);
  const [requestMeta, setRequestMeta] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [newContext, setNewContext] = useState(null);
  const catalog = useCatalogOptions(
    hasPermission(actor, "applications.read") &&
      hasPermission(actor, "components.read"),
    actor.workspaceId,
  );

  const selectedRequest =
    (selectedRequestOverride?.id === selectedRequestId
      ? selectedRequestOverride
      : requests.find((request) => request.id === selectedRequestId)) || null;
  const isEditing = Boolean(
    selectedRequest?.id && editingRequestId === selectedRequest.id,
  );
  const selectedChecklistItem =
    selectedRequest?.checklist.find(
      (item) => item.label === checklistDialogLabel,
    ) || null;

  async function loadRequests(isActive = () => true) {
    setLoadingRequests(true);
    setRequestError("");

    try {
      const payload = await fetchRequests({
        applicationId: applicationFilter,
        componentId: componentFilter,
        collectionId: collectionId || "__root__",
        status: statusFilters.join(","),
        page: requestPage,
        limit: 25,
      });
      if (!isActive()) return;

      const loadedRequests = sortRequestsForList(
        (payload.items || []).map(normalizeRequest),
      );
      setRequests(loadedRequests);
      setRequestMeta({
        page: payload.meta?.page || requestPage,
        total: payload.meta?.total || 0,
        totalPages: payload.meta?.totalPages || 1,
      });
    } catch (error) {
      if (isActive()) setRequestError(error.message);
    } finally {
      if (isActive()) setLoadingRequests(false);
    }
  }

  async function loadRequestCollectionItems(isActive = () => true) {
    try {
      const payload = await fetchRequestCollectionItems({
        applicationId: applicationFilter,
        componentId: componentFilter,
        status: statusFilters.join(","),
      });
      if (!isActive()) return;
      setRequestCollectionItems(
        sortRequestsForList((payload.items || []).map(normalizeRequest)),
      );
    } catch (error) {
      if (isActive()) setRequestError(error.message);
    }
  }

  useEffect(() => {
    let active = true;
    loadRequests(() => active);

    return () => {
      active = false;
    };
  }, [
    applicationFilter,
    collectionId,
    componentFilter,
    requestPage,
    statusFilters,
  ]);

  useEffect(() => {
    let active = true;
    void loadRequestCollectionItems(() => active);
    return () => {
      active = false;
    };
  }, [applicationFilter, componentFilter, statusFilters]);

  const {
    filteredRequests,
    scheduleJourneyMonths,
    scheduleJourneyRequests,
    scheduleRequests,
    selectedExecutedTotal,
    selectedOverExecutedTotal,
    selectedPendingTotal,
    selectedPlannedJourneyTotal,
  } = useRequestDerivedState({
    collectionId,
    collections,
    requestCollectionItems,
    requests,
    selectedRequest,
    statusFilters,
  });

  const {
    clearScheduledPersist,
    schedulePersistRequest,
    updateRequest,
    updateSelectedField,
    upsertRequestInList,
  } = useRequestPersistence({
    actor,
    selectedRequest,
    selectedRequestId,
    setRequestCollectionItems,
    setRequestError,
    setRequests,
    setSavingRequestId,
    setSelectedRequestOverride,
  });

  const {
    addMissingSpecificationSections,
    addSpecificationSection,
    beginNumberDraft,
    clearNumberDraft,
    commitJourneyMonth,
    commitEstimatedJourneys,
    moveSpecificationSection,
    readDraftedNumber,
    removeChecklistItem,
    removeSpecificationSection,
    toggleChecklistItem,
    updateJourneyComment,
    updateChecklistItem,
    updateNumberDraft,
    updateSpecificationSection,
  } = useRequestDraftActions({
    numberDrafts,
    schedulePersistRequest,
    selectedRequest,
    setChecklistDialogLabel,
    setNumberDrafts,
    setRequestError,
    updateRequest,
    updateSelectedField,
  });

  const {
    addRequestNote,
    addRequestTask,
    addRequestTaskNote,
    removeRequestNote,
    removeRequestTask,
    removeRequestTaskNote,
    updateRequestNote,
    updateRequestTask,
    updateRequestTaskNote,
  } = useRequestCollaborationActions({
    selectedRequest,
    setRequestError,
    setSavingRequestId,
    upsertRequestInList,
  });

  const { moveRequest } = useRequestReorder({
    requestCollectionItems,
    requests,
    setRequestCollectionItems,
    setRequestError,
    setRequests,
    setSavingRequestId,
    statusFilters,
    upsertRequestInList,
  });

  async function addRequest(context = newContext) {
    if (!context?.applicationId) {
      setNewContext({
        applicationId: catalog.applications[0]?.id || "",
        affectedComponentIds: [],
      });
      return;
    }
    const request = {
      ...newRequest(),
      collectionId,
      workspaceId: catalog.workspace?.id,
      ...context,
      listRank: nextTopRequestListRank(requests),
    };

    setSavingRequestId("new");
    setRequestError("");

    try {
      const payload = await createRequest(request);
      const savedRequest = normalizeRequest(payload.request);

      upsertRequestInList(savedRequest);
      setSelectedRequestId(savedRequest.id);
      setSelectedRequestOverride(savedRequest);
      setEditingRequestId(savedRequest.id);
      setNewContext(null);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setSavingRequestId((current) => (current === "new" ? "" : current));
    }
  }

  async function removeSelectedRequest() {
    if (!selectedRequest?.id) return;

    const confirmed = await confirm({
      message: "Excluir esta melhoria?",
      tone: "danger",
    });
    if (!confirmed) return;

    const requestId = selectedRequest.id;
    clearScheduledPersist(requestId);
    setSavingRequestId(requestId);
    setRequestError("");

    try {
      await deleteRequest(requestId);
      setRequests((current) => {
        const nextRequests = current.filter(
          (request) => request.id !== requestId,
        );
        setSelectedRequestId("");
        return nextRequests;
      });
      setRequestCollectionItems((current) =>
        current.filter((request) => request.id !== requestId),
      );
      setEditingRequestId("");
      setSelectedRequestOverride(null);
      setChecklistDialogLabel("");
      setNumberDrafts({});
      setActiveDetailTab("main");
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setSavingRequestId((current) => (current === requestId ? "" : current));
    }
  }

  const { closeSelectedRequest, selectRequest, toggleSelectedEditMode } =
    useRequestSelection({
      requests,
      selectedRequest,
      setActiveDetailTab,
      setChecklistDialogLabel,
      setEditingRequestId,
      setNumberDrafts,
      setRequestError,
      setSelectedRequestId,
      setSelectedRequestOverride,
      upsertRequestInList,
    });

  return {
    catalog,
    savingRequestId,
    addRequest,
    requestError,
    selectedRequest,
    applicationFilter,
    setApplicationFilter,
    componentFilter,
    setComponentFilter,
    setRequestPage,
    statusFilters,
    filteredRequests,
    loadingRequests,
    moveRequest,
    requestMeta,
    requestCollectionItems,
    loadRequests,
    loadRequestCollectionItems,
    selectRequest,
    setStatusFilters,
    selectedRequestId,
    activeDetailTab,
    selectedExecutedTotal,
    selectedOverExecutedTotal,
    selectedPlannedJourneyTotal,
    selectedPendingTotal,
    isEditing,
    beginNumberDraft,
    updateJourneyComment,
    commitJourneyMonth,
    addRequestNote,
    addRequestTask,
    addRequestTaskNote,
    addSpecificationSection,
    addMissingSpecificationSections,
    clearNumberDraft,
    closeChecklistDialog: () => setChecklistDialogLabel(""),
    closeSelectedRequest,
    commitEstimatedJourneys,
    removeSelectedRequest,
    removeRequestNote,
    removeRequestTask,
    removeRequestTaskNote,
    removeChecklistItem,
    updateSelectedField,
    moveSpecificationSection,
    readDraftedNumber,
    upsertRequestInList,
    updateRequest,
    schedulePersistRequest,
    removeSpecificationSection,
    setActiveDetailTab,
    toggleChecklistItem,
    toggleSelectedEditMode,
    updateChecklistItem,
    updateNumberDraft,
    updateRequestNote,
    updateRequestTask,
    updateRequestTaskNote,
    updateSpecificationSection,
    selectedChecklistItem,
    activeOverviewTab,
    setActiveOverviewTab,
    scheduleJourneyMonths,
    scheduleJourneyRequests,
    scheduleRequests,
    newContext,
    setNewContext,
  };
}
