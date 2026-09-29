import { httpError } from "./support.js";
import { DOCUMENT_TYPE_CATALOG } from "../../../../shared/documentTypes.js";

export const DOCUMENT_TYPES = DOCUMENT_TYPE_CATALOG;

export function documentTypeConfig(type) {
  const normalized = String(type || "").trim();
  const config = DOCUMENT_TYPES[normalized];
  if (!config) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_TYPE",
      `Tipo de documento não suportado: ${type}`,
    );
  }
  return { ...config, type: normalized };
}
