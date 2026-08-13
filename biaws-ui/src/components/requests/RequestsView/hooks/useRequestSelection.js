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
  function resetSelectionState() {
    setEditingRequestId("");
    setChecklistDialogLabel("");
    setNumberDrafts({});
    setActiveDetailTab("main");
  }

  async function selectRequest(requestId) {
    setSelectedRequestId(requestId);
    resetSelectionState();
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

  function closeSelectedRequest() {
    setSelectedRequestId("");
    setSelectedRequestOverride(null);
    resetSelectionState();
  }

  function toggleSelectedEditMode() {
    if (!selectedRequest) return;
    setEditingRequestId((current) =>
      current === selectedRequest.id ? "" : selectedRequest.id,
    );
  }

  return { closeSelectedRequest, selectRequest, toggleSelectedEditMode };
}
