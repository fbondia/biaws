import { deleteJson, fetchJson, sendJson } from "../../httpClient.js";

const RESOURCE_TYPES = new Set([
  "applications",
  "architecture-decisions",
  "business-rules",
  "procedures",
  "secrets",
  "skills",
  "servers",
]);

function requiredId(args, field) {
  const value = String(args?.[field] || "").trim();
  if (!value) throw new Error(`${field} is required`);
  return value;
}

function resourceType(args = {}) {
  const type = requiredId(args, "resourceType");
  if (!RESOURCE_TYPES.has(type)) {
    throw new Error(`unsupported resourceType: ${type}`);
  }
  return type;
}

function collectionsPath(type, collectionId = "") {
  const base =
    type === "procedures"
      ? "/api/procedures/collections"
      : `/api/resource-collections/${encodeURIComponent(type)}`;
  return collectionId ? `${base}/${encodeURIComponent(collectionId)}` : base;
}

function destinationCollectionId(args = {}) {
  if (!Object.hasOwn(args, "collectionId")) {
    throw new Error("collectionId is required; use an empty string for root");
  }
  return String(args.collectionId || "").trim();
}

function collectionPayload(args = {}, { requireName = false } = {}) {
  const payload = {};
  if (Object.hasOwn(args, "name")) {
    const name = String(args.name || "").trim();
    if (!name) throw new Error("name is required");
    payload.name = name;
  }
  if (Object.hasOwn(args, "parentId")) {
    payload.parentId = String(args.parentId || "").trim();
  }
  if (requireName && !payload.name) throw new Error("name is required");
  if (!Object.keys(payload).length) {
    throw new Error("at least one mutable field is required");
  }
  return payload;
}

export async function listResourceCollections(args = {}) {
  return fetchJson(collectionsPath(resourceType(args)));
}

export async function createResourceCollection(args = {}) {
  return sendJson(
    collectionsPath(resourceType(args)),
    collectionPayload(args, { requireName: true }),
    {},
    "POST",
  );
}

export async function updateResourceCollection(args = {}) {
  const type = resourceType(args);
  const collectionId = requiredId(args, "collectionId");
  return sendJson(
    collectionsPath(type, collectionId),
    collectionPayload(args),
    {},
    "PATCH",
  );
}

export async function deleteResourceCollection(args = {}) {
  return deleteJson(
    collectionsPath(resourceType(args), requiredId(args, "collectionId")),
  );
}

function move(path, collectionId) {
  return sendJson(
    path,
    { collectionId: String(collectionId || "").trim() },
    {},
    "PATCH",
  );
}

export async function moveApplicationToCollection(args = {}) {
  const id = requiredId(args, "applicationId");
  return move(
    `/api/catalog/applications/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveServerToCollection(args = {}) {
  const id = requiredId(args, "serverId");
  return move(
    `/api/catalog/servers/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveSecretToCollection(args = {}) {
  const id = requiredId(args, "secretId");
  return move(
    `/api/secrets/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveSkillToCollection(args = {}) {
  const id = requiredId(args, "skillId");
  return move(
    `/api/skills/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveProcedureToCollection(args = {}) {
  const id = requiredId(args, "procedureId");
  return move(
    `/api/procedures/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveBusinessRuleToCollection(args = {}) {
  const id = requiredId(args, "businessRuleId");
  return move(
    `/api/knowledge/business-rules/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}

export async function moveArchitectureDecisionToCollection(args = {}) {
  const id = requiredId(args, "architectureDecisionId");
  return move(
    `/api/knowledge/architecture-decisions/${encodeURIComponent(id)}/collection`,
    destinationCollectionId(args),
  );
}
