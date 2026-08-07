import { deleteJson, fetchJson, sendJson } from "./client.js";

function basePath(type) {
  return `/api/knowledge/${encodeURIComponent(type)}`;
}

export function fetchKnowledgeRecords(type, params) {
  return fetchJson(basePath(type), params);
}

export function fetchKnowledgeRecord(type, id) {
  return fetchJson(`${basePath(type)}/${encodeURIComponent(id)}`);
}

export function createKnowledgeRecord(type, record) {
  return sendJson(basePath(type), record, undefined, "POST");
}

export function saveKnowledgeRecord(type, id, record) {
  return sendJson(
    `${basePath(type)}/${encodeURIComponent(id)}`,
    record,
    undefined,
    "PUT",
  );
}

export function archiveKnowledgeRecord(type, id) {
  return deleteJson(`${basePath(type)}/${encodeURIComponent(id)}`);
}

export function moveKnowledgeRecordToCollection(type, id, collectionId) {
  return sendJson(
    `${basePath(type)}/${encodeURIComponent(id)}/collection`,
    { collectionId },
    undefined,
    "PATCH",
  );
}

export function fetchKnowledgeRevisions(type, id) {
  return fetchJson(`${basePath(type)}/${encodeURIComponent(id)}/revisions`);
}

export function fetchKnowledgeObservations(type, id) {
  return fetchJson(`${basePath(type)}/${encodeURIComponent(id)}/observations`);
}

export function addKnowledgeObservation(type, id, markdown) {
  return sendJson(
    `${basePath(type)}/${encodeURIComponent(id)}/observations`,
    { markdown },
    undefined,
    "POST",
  );
}
