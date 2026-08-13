import { useEffect, useRef } from "react";

import { fetchRequest, saveRequest } from "../../../../api.js";
import {
  createPendingRequestSave,
  flushPendingRequestSaves,
} from "../requestSaveQueue.js";
import {
  normalizeRequest,
  REQUEST_SAVE_DEBOUNCE_MS,
  sortRequestsForList,
} from "../../requestUtils.js";

export function useRequestPersistence({
  actor,
  selectedRequest,
  selectedRequestId,
  setRequestCollectionItems,
  setRequestError,
  setRequests,
  setSavingRequestId,
  setSelectedRequestOverride,
}) {
  const saveTimersRef = useRef(new Map());
  const pendingRequestsRef = useRef(new Map());
  const requestSaveVersionsRef = useRef(new Map());
  const mountedRef = useRef(true);

  function upsertRequestInList(nextRequest) {
    const normalizedRequest = normalizeRequest(nextRequest);
    if (normalizedRequest.id === selectedRequestId) {
      setSelectedRequestOverride(normalizedRequest);
    }
    setRequests((current) => {
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
        current.map((request) =>
          request.id === requestId
            ? normalizeRequest(updater(request))
            : request,
        ),
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
      if (mountedRef.current) {
        setSavingRequestId((current) =>
          current === request.id ? "" : current,
        );
      }
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

  return {
    clearScheduledPersist,
    schedulePersistRequest,
    updateRequest,
    updateSelectedField,
    upsertRequestInList,
  };
}
