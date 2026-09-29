import { RESOURCE_CONFIG } from "./constants.js";
import { httpError } from "./support.js";

export function normalizeDocument(document) {
  if (!document) return null;
  return { ...document, _id: document._id?.toString?.() ?? document._id };
}

export function assertResourceCollectionType(resourceType) {
  const type = String(resourceType || "").trim();
  if (!RESOURCE_CONFIG[type]) {
    throw httpError(
      404,
      "RESOURCE_COLLECTION_TYPE_NOT_FOUND",
      `Tipo de coleção não suportado: ${type}`,
    );
  }
  return type;
}

export function normalizeName(value) {
  const name = String(value || "").trim();
  if (!name) {
    throw httpError(
      422,
      "INVALID_COLLECTION",
      "O nome da coleção é obrigatório",
    );
  }
  if (name.length > 120) {
    throw httpError(
      422,
      "INVALID_COLLECTION",
      "O nome da coleção deve ter no máximo 120 caracteres",
    );
  }
  return name;
}
