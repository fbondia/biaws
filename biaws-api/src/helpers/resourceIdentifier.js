import { CATALOG_KEY_PATTERN, CATALOG_LIMITS } from "../../../shared/index.js";

export function normalizeResourceIdentifier(value, current = null) {
  const identifier = String(value ?? current ?? "")
    .trim()
    .toLowerCase();
  if (!identifier) return null;
  if (
    identifier.length > CATALOG_LIMITS.key ||
    !CATALOG_KEY_PATTERN.test(identifier)
  ) {
    const error = new Error(
      `identifier deve ter até ${CATALOG_LIMITS.key} caracteres e usar letras minúsculas, números e hífens simples`,
    );
    error.statusCode = 422;
    error.code = "INVALID_RESOURCE_IDENTIFIER";
    throw error;
  }
  return identifier;
}

export function requireReplicationIdentifier(resource, resourceLabel) {
  if (resource?.identifier) return resource.identifier;
  const error = new Error(
    `Defina um identificador no ${resourceLabel} antes de replicá-lo`,
  );
  error.statusCode = 422;
  error.code = "REPLICATION_IDENTIFIER_REQUIRED";
  throw error;
}
