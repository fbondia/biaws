import { textValue } from "../../helpers/text.js";
import { RESOURCE_CONFIG } from "./constants.js";
import { httpError } from "./support.js";

function normalizeDocumentValue<T extends object>(document: T | null) {
  if (!document) return null;
  const id = "_id" in document ? document._id : undefined;
  return { ...document, _id: id == null ? undefined : textValue(id) };
}

export function assertResourceCollectionType(resourceType: string | string[]) {
  const type = String(resourceType || "").trim();
  if (!(type in RESOURCE_CONFIG)) {
    throw httpError(404, "RESOURCE_COLLECTION_TYPE_NOT_FOUND", `Tipo de coleção não suportado: ${type}`);
  }
  return type as keyof typeof RESOURCE_CONFIG;
}

export function normalizeName(value: unknown) {
  const name = textValue(value || "").trim();
  if (!name) {
    throw httpError(422, "INVALID_COLLECTION", "O nome da coleção é obrigatório");
  }
  if (name.length > 120) {
    throw httpError(422, "INVALID_COLLECTION", "O nome da coleção deve ter no máximo 120 caracteres");
  }
  return name;
}

export function normalizeDocument<T extends object>(document: T): Omit<T, "_id"> & { _id: string | undefined };
export function normalizeDocument<T extends object>(
  document: T | null,
): (Omit<T, "_id"> & { _id: string | undefined }) | null;
export function normalizeDocument<T extends object>(document: T | null) {
  return normalizeDocumentValue(document);
}
