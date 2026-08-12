import { deleteJson, fetchJson, sendJson } from "./client.js";

export function fetchRequests(params) {
  return fetchJson("/api/requests", params);
}

export function fetchRequest(requestId, params) {
  return fetchJson(`/api/requests/${encodeURIComponent(requestId)}`, params);
}

export function fetchRequestCollectionItems(params) {
  return fetchJson("/api/requests/collection-items", params);
}

export function createRequest(request, params) {
  return sendJson("/api/requests", request, params, "POST");
}

export function saveRequest(requestId, request, params, workspaceId) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}`,
    request,
    params,
    "PUT",
    { workspaceId },
  );
}

export function createRequestNote(requestId, note, params) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}/notes`,
    note,
    params,
    "POST",
  );
}

export function saveRequestNote(requestId, noteId, note, params) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}/notes/${encodeURIComponent(noteId)}`,
    note,
    params,
  );
}

export function deleteRequestNote(requestId, noteId, params) {
  return deleteJson(
    `/api/requests/${encodeURIComponent(requestId)}/notes/${encodeURIComponent(noteId)}`,
    params,
  );
}

export function createRequestTask(requestId, task, params) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}/tasks`,
    task,
    params,
    "POST",
  );
}

export function saveRequestTask(requestId, taskId, task, params) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}/tasks/${encodeURIComponent(taskId)}`,
    task,
    params,
  );
}

export function deleteRequestTask(requestId, taskId, params) {
  return deleteJson(
    `/api/requests/${encodeURIComponent(requestId)}/tasks/${encodeURIComponent(taskId)}`,
    params,
  );
}

export function createRequestTaskNote(requestId, taskId, note, params) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}/tasks/${encodeURIComponent(taskId)}/notes`,
    note,
    params,
    "POST",
  );
}

export function saveRequestTaskNote(requestId, taskId, noteId, note, params) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}/tasks/${encodeURIComponent(taskId)}/notes/${encodeURIComponent(noteId)}`,
    note,
    params,
  );
}

export function deleteRequestTaskNote(requestId, taskId, noteId, params) {
  return deleteJson(
    `/api/requests/${encodeURIComponent(requestId)}/tasks/${encodeURIComponent(taskId)}/notes/${encodeURIComponent(noteId)}`,
    params,
  );
}

export function reorderRequest(requestId, placement, params) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}/order`,
    placement,
    params,
    "PATCH",
  );
}

export function moveRequestToCollection(requestId, collectionId, params) {
  return sendJson(
    `/api/requests/${encodeURIComponent(requestId)}/collection`,
    { collectionId },
    params,
    "PATCH",
  );
}

export function deleteRequest(requestId, params) {
  return deleteJson(`/api/requests/${encodeURIComponent(requestId)}`, params);
}
