import { deleteJson, fetchJson, sendJson } from "./client.js";

const BASE_PATH = "/api/knowledge/documents";

export function fetchDocuments(params) {
  return fetchJson(BASE_PATH, params);
}

export function fetchDocument(id) {
  return fetchJson(`${BASE_PATH}/${encodeURIComponent(id)}`);
}

export function createDocument(document) {
  return sendJson(BASE_PATH, document, undefined, "POST");
}

export function saveDocument(id, document) {
  return sendJson(
    `${BASE_PATH}/${encodeURIComponent(id)}`,
    document,
    undefined,
    "PUT",
  );
}

export function archiveDocument(id) {
  return deleteJson(`${BASE_PATH}/${encodeURIComponent(id)}`);
}

export function moveDocumentToCollection(id, collectionId) {
  return sendJson(
    `${BASE_PATH}/${encodeURIComponent(id)}/collection`,
    { collectionId },
    undefined,
    "PATCH",
  );
}

export function fetchDocumentRevisions(id) {
  return fetchJson(`${BASE_PATH}/${encodeURIComponent(id)}/revisions`);
}

export function fetchDocumentObservations(id) {
  return fetchJson(`${BASE_PATH}/${encodeURIComponent(id)}/observations`);
}

export function addDocumentObservation(id, markdown) {
  return sendJson(
    `${BASE_PATH}/${encodeURIComponent(id)}/observations`,
    { markdown },
    undefined,
    "POST",
  );
}
