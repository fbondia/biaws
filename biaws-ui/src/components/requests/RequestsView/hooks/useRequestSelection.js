import { useEffect, useRef } from "react";
import { useRoute } from "../../../../navigation/location.js";
import { fetchRequest } from "../../../../api.js";
import { normalizeRequest } from "../../requestUtils.js";

export function useRequestSelection({
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
}) {
  const route = useRoute();
  const selectionVersion = useRef(0);
  useEffect(() => {
    selectionVersion.current += 1;
    return () => {
      selectionVersion.current += 1;
    };
  }, [route.selections.demand]);

  function resetSelectionState() {
    setEditingRequestId("");
    setChecklistDialogLabel("");
    setNumberDrafts({});
    setActiveDetailTab("main");
  }

  async function selectRequest(requestId) {
    const version = ++selectionVersion.current;
    setSelectedRequestId(requestId);
    resetSelectionState();
    const loadedRequest = requests.find((request) => request.id === requestId);
    if (loadedRequest) {
      setSelectedRequestOverride(loadedRequest);
      return;
    }

    try {
      const payload = await fetchRequest(requestId);
      if (version !== selectionVersion.current) return;
      if (payload.request) {
        const request = normalizeRequest(payload.request);
        setSelectedRequestOverride(request);
        upsertRequestInList(request);
      }
    } catch (error) {
      if (version !== selectionVersion.current) return;
      setRequestError(error.message);
      setSelectedRequestId("");
      setSelectedRequestOverride(null);
    }
  }

  function closeSelectedRequest() {
    selectionVersion.current += 1;
    setSelectedRequestId("");
    setSelectedRequestOverride(null);
    resetSelectionState();
  }

  function toggleSelectedEditMode() {
    if (!selectedRequest) return;
    setEditingRequestId((current) => (current === selectedRequest.id ? "" : selectedRequest.id));
  }

  return { closeSelectedRequest, selectRequest, toggleSelectedEditMode };
}
