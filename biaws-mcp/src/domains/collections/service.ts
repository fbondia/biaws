import type { ServiceArguments } from "../../contracts.js";
import { BiawsError } from "../../errors.js";
import { deleteJson, sendJson } from "../../httpClient.js";

const RESOURCE_TYPES = new Set([
  "applications",
  "documents",
  "demands",
  "secrets",
  "skills",
  "servers",
]);

function requiredId(args: Record<string, unknown>, field: string) {
  const value = String(args?.[field] || "").trim();
  if (!value) throw new BiawsError(`${field} is required`);
  return value;
}

function resourceType(args: Record<string, unknown> = {}) {
  const type = requiredId(args, "resourceType");
  if (!RESOURCE_TYPES.has(type)) {
    throw new BiawsError(`unsupported resourceType: ${type}`);
  }
  return type;
}

function collectionsPath(type: string, collectionId = "") {
  const base = `/api/resource-collections/${encodeURIComponent(type)}`;
  return collectionId ? `${base}/${encodeURIComponent(collectionId)}` : base;
}

function destinationCollectionId(args: Record<string, unknown> = {}) {
  if (!Object.hasOwn(args, "collectionId")) {
    throw new BiawsError(
      "collectionId is required; use an empty string for root",
    );
  }
  return String(args.collectionId || "").trim();
}

function collectionPayload(
  args: Record<string, unknown> = {},
  { requireName = false } = {},
) {
  const payload: { name?: string; parentId?: string } = {};
  if (Object.hasOwn(args, "name")) {
    const name = String(args.name || "").trim();
    if (!name) throw new BiawsError("name is required");
    payload.name = name;
  }
  if (Object.hasOwn(args, "parentId")) {
    payload.parentId = String(args.parentId || "").trim();
  }
  if (requireName && !payload.name) throw new BiawsError("name is required");
  if (!Object.keys(payload).length) {
    throw new BiawsError("at least one mutable field is required");
  }
  return payload;
}

export async function createResourceCollection(
  args: ServiceArguments<"resource_collections_create"> = {},
) {
  return sendJson(
    collectionsPath(resourceType(args)),
    collectionPayload(args, { requireName: true }),
    {},
    "POST",
  );
}

export async function updateResourceCollection(
  args: ServiceArguments<"resource_collections_update"> = {},
) {
  const type = resourceType(args);
  const collectionId = requiredId(args, "collectionId");
  return sendJson(
    collectionsPath(type, collectionId),
    collectionPayload(args),
    {},
    "PATCH",
  );
}

export async function deleteResourceCollection(
  args: ServiceArguments<"resource_collections_delete"> = {},
) {
  return deleteJson(
    collectionsPath(resourceType(args), requiredId(args, "collectionId")),
  );
}

function move(path: string, collectionId: string) {
  return sendJson(
    path,
    { collectionId: String(collectionId || "").trim() },
    {},
    "PATCH",
  );
}

export async function moveApplicationToCollection(
  args: ServiceArguments<"applications_move_to_collection"> = {},
) {
  const id = requiredId(args, "applicationId");
  return move(
    `/api/catalog/applications/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveServerToCollection(
  args: ServiceArguments<"servers_move_to_collection"> = {},
) {
  const id = requiredId(args, "serverId");
  return move(
    `/api/catalog/servers/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveSecretToCollection(
  args: ServiceArguments<"secrets_move_to_collection"> = {},
) {
  const id = requiredId(args, "secretId");
  return move(
    `/api/secrets/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveSkillToCollection(
  args: ServiceArguments<"skills_move_to_collection"> = {},
) {
  const id = requiredId(args, "skillId");
  return move(
    `/api/skills/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveDemandToCollection(
  args: ServiceArguments<"demands_move_to_collection"> = {},
) {
  const id = requiredId(args, "requestId");
  return move(
    `/api/requests/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveDocumentToCollection(
  args: ServiceArguments<"documents_move_to_collection"> = {},
) {
  const id = requiredId(args, "documentId");
  return move(
    `/api/knowledge/documents/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}
