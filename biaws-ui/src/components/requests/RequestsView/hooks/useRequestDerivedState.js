import { useMemo } from "react";

import {
  normalizeRequestStatus,
  requestsInCollectionBranch,
  scheduleSortValue,
} from "../../requestUtils.js";

export function useRequestDerivedState({
  collectionId,
  collections,
  requestCollectionItems,
  requests,
  selectedRequest,
  statusFilters,
}) {
  const filteredRequests = useMemo(() => {
    if (!statusFilters.length) return requests;
    return requests.filter((request) =>
      statusFilters.includes(normalizeRequestStatus(request.status)),
    );
  }, [requests, statusFilters]);

  const plannedTotal = (selectedRequest?.journeys || []).reduce(
    (total, item) => total + (Number(item.plannedJourneys) || 0),
    0,
  );
  const executedTotal = (selectedRequest?.journeys || []).reduce(
    (total, item) => total + (Number(item.executedJourneys) || 0),
    0,
  );
  const scheduleRequests = useMemo(() => {
    const branchRequests = requestsInCollectionBranch(
      collections,
      requestCollectionItems,
      collectionId,
    );
    return [...branchRequests].sort(
      (first, second) =>
        scheduleSortValue(
          first.estimatedDeliveryDate || first.endDate || first.startDate,
        ) -
        scheduleSortValue(
          second.estimatedDeliveryDate || second.endDate || second.startDate,
        ),
    );
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

  return {
    filteredRequests,
    scheduleJourneyMonths,
    scheduleJourneyRequests,
    scheduleRequests,
    selectedExecutedTotal: executedTotal,
    selectedOverExecutedTotal: Math.max(0, executedTotal - plannedTotal),
    selectedPendingTotal: Math.max(0, plannedTotal - executedTotal),
    selectedPlannedJourneyTotal: plannedTotal,
  };
}
