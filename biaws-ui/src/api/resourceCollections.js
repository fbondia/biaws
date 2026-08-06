import { deleteJson, fetchJson, sendJson } from "./client.js";

function basePath(resourceType) {
  return `/api/resource-collections/${encodeURIComponent(resourceType)}`;
}

export function fetchResourceCollections(resourceType) {
  return fetchJson(basePath(resourceType));
}

export function createResourceCollection(resourceType, collection) {
  return sendJson(basePath(resourceType), collection, undefined, "POST");
}

export function updateResourceCollection(
  resourceType,
  collectionId,
  collection,
) {
  return sendJson(
    `${basePath(resourceType)}/${encodeURIComponent(collectionId)}`,
    collection,
    undefined,
    "PATCH",
  );
}

export function deleteResourceCollection(resourceType, collectionId) {
  return deleteJson(
    `${basePath(resourceType)}/${encodeURIComponent(collectionId)}`,
  );
}
