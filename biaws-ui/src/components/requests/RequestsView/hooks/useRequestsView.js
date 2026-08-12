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
import { useMessages } from "../../../../infrastructure/messages/MessagesProvider.jsx";
import { useCatalogOptions } from "../../../catalog/CatalogContextFields.jsx";
import { useRequestCollaborationActions } from "./useRequestCollaborationActions.js";
import { useRequestDraftActions } from "./useRequestDraftActions.js";
import {
  createPendingRequestSave,
  flushPendingRequestSaves,
} from "../requestSaveQueue.js";
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
  const requestSaveVersionsRef = useRef(new Map());
  const mountedRef = useRef(true);

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
      mountedRef.current = false;
      void flushPendingRequestSaves({
        timers: saveTimersRef.current,
        pendingRequests: pendingRequestsRef.current,
        persist: ({ request, workspaceId }) =>
          saveRequest(request.id, request, undefined, workspaceId),
      });
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

  async function recoverFailedRequestSave(request, saveVersion) {
    const isLatestSave =
      requestSaveVersionsRef.current.get(request.id) === saveVersion;
    if (!isLatestSave || pendingRequestsRef.current.has(request.id)) return;

    try {
      const payload = await fetchRequest(request.id);
      if (mountedRef.current && payload.request) {
        upsertRequestInList(payload.request);
      }
    } catch {
      // Mantém o erro original da gravação, que é a ação relevante ao usuário.
    }
  }

  function finishRequestSave(requestId) {
    if (!mountedRef.current) return;
    setSavingRequestId((current) => (current === requestId ? "" : current));
  }

  async function persistRequest(request, saveVersion, workspaceId) {
    if (!request?.id) return;

    if (mountedRef.current) {
      setSavingRequestId(request.id);
      setRequestError("");
    }

    try {
      const payload = await saveRequest(
        request.id,
        request,
        undefined,
        workspaceId,
      );
      if (mountedRef.current && payload.request) {
        upsertRequestInList(payload.request);
      }
    } catch (error) {
      if (!mountedRef.current) return;

      setRequestError(error.message);
      await recoverFailedRequestSave(request, saveVersion);
    } finally {
      finishRequestSave(request.id);
    }
  }

  function schedulePersistRequest(request) {
    if (!request?.id) return;

    const existingTimer = saveTimersRef.current.get(request.id);
    if (existingTimer) clearTimeout(existingTimer);

    pendingRequestsRef.current.set(
      request.id,
      createPendingRequestSave(request, actor.workspaceId),
    );
    const saveVersion =
      (requestSaveVersionsRef.current.get(request.id) || 0) + 1;
    requestSaveVersionsRef.current.set(request.id, saveVersion);
    setSavingRequestId(request.id);
    setRequestError("");

    const timeoutId = setTimeout(() => {
      saveTimersRef.current.delete(request.id);
      const pendingSave = pendingRequestsRef.current.get(request.id);
      pendingRequestsRef.current.delete(request.id);
      void persistRequest(
        pendingSave?.request,
        saveVersion,
        pendingSave?.workspaceId,
      );
    }, REQUEST_SAVE_DEBOUNCE_MS);

    saveTimersRef.current.set(request.id, timeoutId);
  }

  function clearScheduledPersist(requestId) {
    const existingTimer = saveTimersRef.current.get(requestId);
    if (existingTimer) clearTimeout(existingTimer);
    saveTimersRef.current.delete(requestId);
    pendingRequestsRef.current.delete(requestId);
    requestSaveVersionsRef.current.delete(requestId);
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

    const movedRequest = requestCollectionItems.find(
      (request) => request.id === requestId,
    );
    const targetRequest = requestCollectionItems.find(
      (request) => request.id === targetRequestId,
    );
    if (
      !movedRequest ||
      !targetRequest ||
      String(movedRequest.collectionId || "") !==
        String(targetRequest.collectionId || "")
    )
      return;

    const collectionRequests = requestCollectionItems.filter(
      (request) =>
        String(request.collectionId || "") ===
        String(movedRequest.collectionId || ""),
    );
    const currentIndex = collectionRequests.findIndex(
      (request) => request.id === requestId,
    );
    const targetIndex = collectionRequests.findIndex(
      (request) => request.id === targetRequestId,
    );

    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex)
      return;

    const nextCollectionRequests = [...collectionRequests];
    nextCollectionRequests.splice(currentIndex, 1);
    nextCollectionRequests.splice(targetIndex, 0, movedRequest);

    const previousRequest = nextCollectionRequests[targetIndex - 1] || null;
    const nextRequest = nextCollectionRequests[targetIndex + 1] || null;
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

    const requestsBeforeMove = requests;
    const collectionItemsBeforeMove = requestCollectionItems;
    const applyOptimisticRank = (items) =>
      sortRequestsForList(
        items.map((request) =>
          request.id === requestId
            ? { ...request, listRank: optimisticRank }
            : request,
        ),
      );

    setRequests((current) => applyOptimisticRank(current));
    setRequestCollectionItems((current) => applyOptimisticRank(current));
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
      setRequests(requestsBeforeMove);
      setRequestCollectionItems(collectionItemsBeforeMove);
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
