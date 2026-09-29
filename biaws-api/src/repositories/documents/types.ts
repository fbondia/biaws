import { httpError } from "./support.js";
import { DOCUMENT_TYPE_CATALOG } from "../../../../shared/documentTypes.js";

export const DOCUMENT_TYPES = DOCUMENT_TYPE_CATALOG;

export function documentTypeConfig(type: string) {
  const normalized = String(type || "").trim();
  const config = Object.hasOwn(DOCUMENT_TYPES, normalized)
    ? DOCUMENT_TYPES[normalized as keyof typeof DOCUMENT_TYPES]
    : undefined;
  if (!config) {
    throw httpError(422, "INVALID_DOCUMENT_TYPE", `Tipo de documento não suportado: ${type}`);
  }
  return { ...config, type: normalized };
}
