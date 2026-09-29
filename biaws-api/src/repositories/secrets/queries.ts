import type { Filter } from "mongodb";
import { findByReference } from "../../helpers/referenceLookup.js";
import { textValue } from "../../helpers/text.js";
import type { AuthorizationScope, RepositoryQuery } from "../../types/http.js";
import type { SecretDocument } from "../../types/secrets.js";
import { SECRET_ENVIRONMENTS } from "./constants.js";
import { accessFilter } from "./filters.js";
import { publicSecret } from "./normalization.js";
import { getCollections } from "./storage.js";
import { secretError } from "./support.js";

export async function listSecrets(query: RepositoryQuery = {}) {
  const { secrets } = await getCollections();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const status = textValue(query.status || "").trim();
  if (status && !["active", "archived"].includes(status)) {
    throw secretError(422, "INVALID_SECRET_FILTER", "status is invalid");
  }
  const filter: Filter<SecretDocument> = {
    ...accessFilter(query.authorizationScope || {}),
  };
  if (status) filter.status = status;
  else if (textValue(query.includeArchived || "").toLowerCase() !== "true") {
    filter.status = "active";
  }
  if (query.applicationId) {
    filter.applicationId = String(query.applicationId);
  }
  if (query.environment !== undefined) {
    const environment = textValue(query.environment || "").trim();
    if (!SECRET_ENVIRONMENTS.has(environment)) {
      throw secretError(422, "INVALID_SECRET_FILTER", "environment is invalid");
    }
    filter.environment = environment;
  }
  if (query.provisioningStatus) {
    const provisioningStatus = textValue(query.provisioningStatus).trim();
    if (!["pending", "ready"].includes(provisioningStatus)) {
      throw secretError(422, "INVALID_SECRET_FILTER", "provisioningStatus is invalid");
    }
    filter.provisioningStatus = provisioningStatus === "ready" ? { $in: ["ready", null] } : "pending";
  }
  if (query.collectionId !== undefined) {
    const collectionId = textValue(query.collectionId || "").trim();
    filter.collectionId = collectionId || { $in: ["", null] };
  }
  const [documents, total] = await Promise.all([
    secrets
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    secrets.countDocuments(filter),
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    items: documents.map(publicSecret),
  };
}

export async function getSecretDocument(secretId: unknown, authorizationScope: AuthorizationScope) {
  const { secrets } = await getCollections();
  return findByReference(secrets, secretId, {
    filter: accessFilter(authorizationScope),
    identifierField: "identifier",
    lowercase: true,
  });
}
