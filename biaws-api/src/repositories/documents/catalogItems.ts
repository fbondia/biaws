import { randomUUID } from "node:crypto";
import { isRecord } from "../../helpers/records.js";
import { httpError } from "./support.js";

export function normalizeCatalogItems(value: unknown = []) {
  if (!Array.isArray(value) || value.length > 500) {
    throw httpError(422, "INVALID_DOCUMENT_DETAILS", "details.items deve ser um array com até 500 elementos");
  }
  const ids = new Set<string>();
  return value.map((item, index) => {
    const field = `details.items[${index}]`;
    if (!isRecord(item)) {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field} deve ser um objeto`);
    }
    if (typeof item.title !== "string" || !item.title.trim() || item.title.trim().length > 240) {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field}.title é obrigatório e deve ter até 240 caracteres`);
    }
    if (typeof item.description !== "string" || !item.description.trim()) {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field}.description é obrigatório e deve ser Markdown`);
    }
    const id = item.id === undefined ? randomUUID() : item.id;
    if (typeof id !== "string" || !id.trim() || id.trim().length > 80 || ids.has(id.trim())) {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field}.id deve ser único e ter entre 1 e 80 caracteres`);
    }
    ids.add(id.trim());
    return { id: id.trim(), title: item.title.trim(), description: item.description.trim() };
  });
}
