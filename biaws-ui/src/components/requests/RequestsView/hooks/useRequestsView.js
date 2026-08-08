import { useEffect, useMemo, useRef, useState } from "react";

import {
  createRequest,
  createRequestNote,
  createRequestTask,
  createRequestTaskNote,
  deleteRequest,
  deleteRequestNote,
  deleteRequestTask,
  deleteRequestTaskNote,
  fetchRequest,
  fetchRequestCollectionItems,
  fetchRequests,
  reorderRequest,
  saveRequest,
  saveRequestNote,
  saveRequestTask,
  saveRequestTaskNote,
} from "../../../../api.js";
import { hasPermission } from "../../../../permissions.js";
import { useCatalogOptions } from "../../../catalog/CatalogContextFields.jsx";
import { useRequestCollaborationActions } from "./useRequestCollaborationActions.js";
import { useRequestDraftActions } from "./useRequestDraftActions.js";
import {
  createDefaultSpecificationSection,
  createSpecificationSection,
  normalizeRequest,
  normalizeSpecification,
  normalizeSpecificationSectionTitle,
  normalizeRequestStatus,
  newRequest,
  nextTopRequestListRank,
  REQUEST_SAVE_DEBOUNCE_MS,
  requestsInCollectionBranch,
  scheduleSortValue,
  sortRequestsForList,
} from "../../requestUtils.js";

export function useRequestsView(
  actor,
  { collectionId = "", collections = [] } = {},
) {
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
  const [activeMobileSection, setActiveMobileSection] = useState("requests");
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
  const saveTimersRef = useRef(new Map());
  const pendingRequestsRef = useRef(new Map());

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

  useEffect(() => {
    return () => {
      for (const timeoutId of saveTimersRef.current.values()) {
        clearTimeout(timeoutId);
      }
      saveTimersRef.current.clear();
      pendingRequestsRef.current.clear();
    };
  }, []);

  const filteredRequests = useMemo(() => {
    if (!statusFilters.length) return requests;

    return requests.filter((request) =>
      statusFilters.includes(normalizeRequestStatus(request.status)),
    );
  }, [requests, statusFilters]);

  const selectedPlannedJourneyTotal = (selectedRequest?.journeys || []).reduce(
    (total, item) => total + (Number(item.plannedJourneys) || 0),
    0,
  );
  const selectedExecutedTotal = (selectedRequest?.journeys || []).reduce(
    (total, item) => total + (Number(item.executedJourneys) || 0),
    0,
  );
  const selectedPendingTotal = Math.max(
    0,
    selectedPlannedJourneyTotal - selectedExecutedTotal,
  );
  const selectedOverExecutedTotal = Math.max(
    0,
    selectedExecutedTotal - selectedPlannedJourneyTotal,
  );

  const scheduleRequests = useMemo(() => {
    const branchRequests = requestsInCollectionBranch(
      collections,
      requestCollectionItems,
      collectionId,
    );

    return [...branchRequests].sort((first, second) => {
      return (
        scheduleSortValue(
          first.estimatedDeliveryDate || first.endDate || first.startDate,
        ) -
        scheduleSortValue(
          second.estimatedDeliveryDate || second.endDate || second.startDate,
        )
      );
    });
  }, [collectionId, collections, requestCollectionItems]);

  const scheduleJourneyMonths = useMemo(() => {
    const months = new Set();

    for (const request of filteredRequests) {
      for (const item of request.journeys) {
        if (
          (Number(item.plannedJourneys) || 0) > 0 ||
          (Number(item.executedJourneys) || 0) > 0
        ) {
          months.add(item.month);
        }
      }
    }

    return [...months].sort((first, second) => first.localeCompare(second));
  }, [filteredRequests]);

  const scheduleJourneyRequests = useMemo(() => {
    if (!scheduleJourneyMonths.length) return [];

    return scheduleRequests.filter((request) =>
      request.journeys.some(
        (item) =>
          (Number(item.plannedJourneys) || 0) > 0 ||
          (Number(item.executedJourneys) || 0) > 0,
      ),
    );
  }, [scheduleJourneyMonths.length, scheduleRequests]);

  function upsertRequestInList(nextRequest) {
    const normalizedRequest = normalizeRequest(nextRequest);
    if (normalizedRequest.id === selectedRequestId) {
      setSelectedRequestOverride(normalizedRequest);
    }
    setRequests((current) => {
      const exists = current.some(
        (request) => request.id === normalizedRequest.id,
      );
      const nextRequests = exists
        ? current.map((request) =>
            request.id === normalizedRequest.id ? normalizedRequest : request,
          )
        : [normalizedRequest, ...current];

      return sortRequestsForList(nextRequests);
    });
    setRequestCollectionItems((current) => {
      const exists = current.some(
        (request) => request.id === normalizedRequest.id,
      );
      return sortRequestsForList(
        exists
          ? current.map((request) =>
              request.id === normalizedRequest.id ? normalizedRequest : request,
            )
          : [normalizedRequest, ...current],
      );
    });
  }

  function updateRequest(requestId, updater) {
    setSelectedRequestOverride((current) =>
      current?.id === requestId ? normalizeRequest(updater(current)) : current,
    );
    setRequests((current) =>
      sortRequestsForList(
        current.map((request) => {
          return request.id === requestId
            ? normalizeRequest(updater(request))
            : request;
        }),
      ),
    );
  }

  async function persistRequest(request) {
    if (!request?.id) return;

    setSavingRequestId(request.id);
    setRequestError("");

    try {
      const payload = await saveRequest(request.id, request);
      if (payload.request) upsertRequestInList(payload.request);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setSavingRequestId((current) => (current === request.id ? "" : current));
    }
  }

  function schedulePersistRequest(request) {
    if (!request?.id) return;

    const existingTimer = saveTimersRef.current.get(request.id);
    if (existingTimer) clearTimeout(existingTimer);

    pendingRequestsRef.current.set(request.id, request);
    setSavingRequestId(request.id);
    setRequestError("");

    const timeoutId = setTimeout(() => {
      saveTimersRef.current.delete(request.id);
      const pendingRequest = pendingRequestsRef.current.get(request.id);
      pendingRequestsRef.current.delete(request.id);
      void persistRequest(pendingRequest);
    }, REQUEST_SAVE_DEBOUNCE_MS);

    saveTimersRef.current.set(request.id, timeoutId);
  }

  function clearScheduledPersist(requestId) {
    const existingTimer = saveTimersRef.current.get(requestId);
    if (existingTimer) clearTimeout(existingTimer);
    saveTimersRef.current.delete(requestId);
    pendingRequestsRef.current.delete(requestId);
  }

  function updateSelectedField(field, value) {
    if (!selectedRequest) return;

    const nextRequest = normalizeRequest({
      ...selectedRequest,
      [field]: field === "estimatedJourneys" ? Number(value) : value,
    });
    updateRequest(selectedRequest.id, () => nextRequest);

    schedulePersistRequest(nextRequest);
  }

  const {
    addMissingSpecificationSections,
    addSpecificationSection,
    beginNumberDraft,
    clearNumberDraft,
    commitJourneyMonth,
    commitEstimatedJourneys,
    moveSpecificationSection,
    readDraftedNumber,
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

    const confirmed = window.confirm("Excluir esta melhoria?");
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

  async function selectRequest(requestId) {
    setSelectedRequestId(requestId);
    setEditingRequestId("");
    setChecklistDialogLabel("");
    setNumberDrafts({});
    setActiveDetailTab("main");

    const loadedRequest = requests.find((request) => request.id === requestId);
    if (loadedRequest) {
      setSelectedRequestOverride(loadedRequest);
      return;
    }

    try {
      const payload = await fetchRequest(requestId);
      if (payload.request) {
        const request = normalizeRequest(payload.request);
        setSelectedRequestOverride(request);
        upsertRequestInList(request);
      }
    } catch (error) {
      setRequestError(error.message);
      setSelectedRequestId("");
      setSelectedRequestOverride(null);
    }
  }

  async function moveRequest(requestId, targetRequestId) {
    if (
      !requestId ||
      !targetRequestId ||
      requestId === targetRequestId ||
      statusFilters.length
    )
      return;

    const currentIndex = requests.findIndex(
      (request) => request.id === requestId,
    );
    const targetIndex = requests.findIndex(
      (request) => request.id === targetRequestId,
    );

    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex)
      return;

    const nextRequests = [...requests];
    const [movedRequest] = nextRequests.splice(currentIndex, 1);
    nextRequests.splice(targetIndex, 0, movedRequest);

    const previousRequest = nextRequests[targetIndex - 1] || null;
    const nextRequest = nextRequests[targetIndex + 1] || null;
    const previousRank = previousRequest?.listRank;
    const nextRank = nextRequest?.listRank;
    const optimisticRank =
      Number.isFinite(previousRank) && Number.isFinite(nextRank)
        ? (previousRank + nextRank) / 2
        : Number.isFinite(nextRank)
          ? nextRank + 1000
          : Number.isFinite(previousRank)
            ? previousRank - 1000
            : Date.now();

    setRequests(
      nextRequests.map((request) =>
        request.id === requestId
          ? { ...request, listRank: optimisticRank }
          : request,
      ),
    );
    setSavingRequestId(requestId);
    setRequestError("");

    try {
      const payload = await reorderRequest(requestId, {
        previousRequestId: previousRequest?.id || "",
        nextRequestId: nextRequest?.id || "",
      });

      if (payload.request) upsertRequestInList(payload.request);
    } catch (error) {
      setRequestError(error.message);
      setRequests((current) => sortRequestsForList(current));
    } finally {
      setSavingRequestId((current) => (current === requestId ? "" : current));
    }
  }

  function closeSelectedRequest() {
    setSelectedRequestId("");
    setSelectedRequestOverride(null);
    setEditingRequestId("");
    setChecklistDialogLabel("");
    setNumberDrafts({});
    setActiveDetailTab("main");
  }

  function closeChecklistDialog() {
    setChecklistDialogLabel("");
  }

  function toggleSelectedEditMode() {
    if (!selectedRequest) return;

    setEditingRequestId((current) =>
      current === selectedRequest.id ? "" : selectedRequest.id,
    );
  }

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
    activeMobileSection,
    setActiveMobileSection,
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
    requests,
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
    closeChecklistDialog,
    closeSelectedRequest,
    commitEstimatedJourneys,
    removeSelectedRequest,
    removeRequestNote,
    removeRequestTask,
    removeRequestTaskNote,
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
