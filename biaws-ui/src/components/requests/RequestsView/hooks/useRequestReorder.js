import { reorderRequest } from "../../../../api.js";
import { sortRequestsForList } from "../../requestUtils.js";

export function useRequestReorder({
  requestCollectionItems,
  requests,
  setRequestCollectionItems,
  setRequestError,
  setRequests,
  setSavingRequestId,
  statusFilters,
  upsertRequestInList,
}) {
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
      setRequests(requests);
      setRequestCollectionItems(requestCollectionItems);
    } finally {
      setSavingRequestId((current) => (current === requestId ? "" : current));
    }
  }

  return { moveRequest };
}
