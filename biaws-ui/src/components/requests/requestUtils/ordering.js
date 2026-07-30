import { scheduleSortValue } from "./dates.js";

export function dateTimeValue(dateValue) {
  if (!dateValue) return 0;

  const value = new Date(dateValue).getTime();
  return Number.isNaN(value) ? 0 : value;
}

export function requestListRankValue(request) {
  const rank = Number(request?.listRank);
  return Number.isFinite(rank)
    ? rank
    : dateTimeValue(request?.updatedAt || request?.createdAt);
}

export function sortRequestsForList(requests) {
  return [...requests].sort((first, second) => {
    return (
      requestListRankValue(second) - requestListRankValue(first) ||
      dateTimeValue(second.updatedAt) - dateTimeValue(first.updatedAt) ||
      dateTimeValue(second.createdAt) - dateTimeValue(first.createdAt)
    );
  });
}

export function nextTopRequestListRank(requests) {
  const topRank = requests.reduce(
    (highestRank, request) =>
      Math.max(highestRank, requestListRankValue(request)),
    0,
  );
  return Math.max(Date.now(), topRank + 1000);
}
