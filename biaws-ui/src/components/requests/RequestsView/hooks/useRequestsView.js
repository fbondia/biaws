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
  scheduleSortValue,
  sortRequestsForList,
} from "../../requestUtils.js";

export function useRequestsView(actor) {
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
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
    requests.find((request) => request.id === selectedRequestId) || null;
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
      setSelectedRequestId((current) =>
        current && loadedRequests.some((request) => request.id === current)
          ? current
          : "",
      );
    } catch (error) {
      if (isActive()) setRequestError(error.message);
    } finally {
      if (isActive()) setLoadingRequests(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadRequests(() => active);

    return () => {
      active = false;
    };
  }, [applicationFilter, componentFilter, requestPage, statusFilters]);

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

  const selectedPlannedBillingTotal = (selectedRequest?.billing || []).reduce(
    (total, item) => total + (Number(item.plannedJourneys) || 0),
    0,
  );
  const selectedBilledTotal = (selectedRequest?.billing || []).reduce(
    (total, item) => total + (Number(item.billedJourneys) || 0),
    0,
  );
  const selectedUnbilledTotal = Math.max(
    0,
    selectedPlannedBillingTotal - selectedBilledTotal,
  );
  const selectedOverbilledTotal = Math.max(
    0,
    selectedBilledTotal - selectedPlannedBillingTotal,
  );

  const scheduleRequests = useMemo(() => {
    return [...filteredRequests].sort((first, second) => {
      return (
        scheduleSortValue(
          first.estimatedDeliveryDate || first.endDate || first.startDate,
        ) -
        scheduleSortValue(
          second.estimatedDeliveryDate || second.endDate || second.startDate,
        )
      );
    });
  }, [filteredRequests]);

  const scheduleBillingMonths = useMemo(() => {
    const months = new Set();

    for (const request of filteredRequests) {
      for (const item of request.billing) {
        if (
          (Number(item.plannedJourneys) || 0) > 0 ||
          (Number(item.billedJourneys) || 0) > 0
        ) {
          months.add(item.month);
        }
      }
    }

    return [...months].sort((first, second) => first.localeCompare(second));
  }, [filteredRequests]);

  const scheduleBillingRequests = useMemo(() => {
    if (!scheduleBillingMonths.length) return [];

    return scheduleRequests.filter((request) =>
      request.billing.some(
        (item) =>
          (Number(item.plannedJourneys) || 0) > 0 ||
          (Number(item.billedJourneys) || 0) > 0,
      ),
    );
  }, [scheduleBillingMonths.length, scheduleRequests]);

  function upsertRequestInList(nextRequest) {
    setRequests((current) => {
      const normalizedRequest = normalizeRequest(nextRequest);
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
  }

  function updateRequest(requestId, updater) {
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
    commitBillingMonth,
    commitEstimatedJourneys,
    moveSpecificationSection,
    readDraftedNumber,
    removeSpecificationSection,
    toggleChecklistItem,
    updateBillingComment,
    updateChecklistItem,
    updateNumberDraft,
    updateSpecificationSection,
  } = useRequestDraftActions({
    numberDrafts,
    schedulePersistRequest,
    selectedRequest,
    setNumberDrafts,
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
      workspaceId: catalog.workspace?.id,
      ...context,
      listRank: nextTopRequestListRank(requests),
    };

    setSavingRequestId("new");
    setRequestError("");

    try {
      const payload = await createRequest(request);
      const savedRequest = normalizeRequest(payload.request);

      setRequests((current) => sortRequestsForList([savedRequest, ...current]));
      setSelectedRequestId(savedRequest.id);
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

    const confirmed = window.confirm("Excluir esta demanda?");
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
      setEditingRequestId("");
      setChecklistDialogLabel("");
      setNumberDrafts({});
      setActiveDetailTab("main");
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setSavingRequestId((current) => (current === requestId ? "" : current));
    }
  }

  function selectRequest(requestId) {
    setSelectedRequestId(requestId);
    setEditingRequestId("");
    setChecklistDialogLabel("");
    setNumberDrafts({});
    setActiveDetailTab("main");
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
    setEditingRequestId("");
    setChecklistDialogLabel("");
    setNumberDrafts({});
    setActiveDetailTab("main");
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
    loadRequests,
    selectRequest,
    setStatusFilters,
    requests,
    selectedRequestId,
    activeDetailTab,
    selectedBilledTotal,
    selectedOverbilledTotal,
    selectedPlannedBillingTotal,
    selectedUnbilledTotal,
    isEditing,
    beginNumberDraft,
    updateBillingComment,
    commitBillingMonth,
    addRequestNote,
    addRequestTask,
    addRequestTaskNote,
    addSpecificationSection,
    addMissingSpecificationSections,
    clearNumberDraft,
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
    scheduleBillingMonths,
    scheduleBillingRequests,
    scheduleRequests,
    newContext,
    setNewContext,
  };
}
