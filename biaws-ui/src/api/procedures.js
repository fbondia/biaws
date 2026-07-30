import { deleteJson, fetchJson, sendJson } from "./client.js";

export function fetchProcedures(params) {
  return fetchJson("/api/procedures", params);
}

export function createProcedure(procedure, params) {
  return sendJson("/api/procedures", procedure, params, "POST");
}

export function saveProcedure(procedureId, procedure, params) {
  return sendJson(
    `/api/procedures/${encodeURIComponent(procedureId)}`,
    procedure,
    params,
  );
}

export function deleteProcedure(procedureId, params) {
  return deleteJson(
    `/api/procedures/${encodeURIComponent(procedureId)}`,
    params,
  );
}

export function fetchProcedureCollections(params) {
  return fetchJson("/api/procedures/collections", params);
}

export function createProcedureCollection(collection, params) {
  return sendJson("/api/procedures/collections", collection, params, "POST");
}

export function saveProcedureCollection(collectionId, collection, params) {
  return sendJson(
    `/api/procedures/collections/${encodeURIComponent(collectionId)}`,
    collection,
    params,
    "PATCH",
  );
}

export function deleteProcedureCollection(collectionId, params) {
  return deleteJson(
    `/api/procedures/collections/${encodeURIComponent(collectionId)}`,
    params,
  );
}

export function moveProcedureToCollection(procedureId, collectionId, params) {
  return sendJson(
    `/api/procedures/${encodeURIComponent(procedureId)}/collection`,
    { collectionId },
    params,
    "PATCH",
  );
}
