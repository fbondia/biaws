import { fetchJson, sendJson } from "./client.js";

export function fetchRuntimeOptionLists() {
  return fetchJson("/api/option-lists/runtime");
}

export function fetchOptionLists() {
  return fetchJson("/api/option-lists");
}

export function updateOptionList(key, optionList) {
  return sendJson(`/api/option-lists/${encodeURIComponent(key)}`, optionList);
}

export function replicateOptionList(key, destinationWorkspaceIds) {
  return sendJson(
    `/api/option-lists/${encodeURIComponent(key)}/replicate`,
    {
      conflictPolicy: "replace",
      ...(Array.isArray(destinationWorkspaceIds)
        ? { destinationWorkspaceIds }
        : { destinationWorkspaceId: destinationWorkspaceIds }),
    },
    undefined,
    "POST",
  );
}
