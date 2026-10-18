import { randomUUID } from "node:crypto";
import { catalogHierarchyError } from "../../../../shared/catalogTree.js";
import { isRecord } from "../../helpers/records.js";
import { httpError } from "./support.js";

export function normalizeCatalogItems(value: unknown = []) {
  if (!Array.isArray(value) || value.length > 500) {
    throw httpError(422, "INVALID_DOCUMENT_DETAILS", "details.items deve ser um array com até 500 elementos");
  }
  const ids = new Set<string>();
  const items = value.map((item, index) => {
    const field = `details.items[${index}]`;
    if (!isRecord(item)) {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field} deve ser um objeto`);
    }
    if (typeof item.title !== "string" || !item.title.trim() || item.title.trim().length > 240) {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field}.title é obrigatório e deve ter até 240 caracteres`);
    }
    if (item.description !== undefined && typeof item.description !== "string") {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field}.description deve ser texto Markdown`);
    }
    if (item.hideDescription !== undefined && typeof item.hideDescription !== "boolean") {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field}.hideDescription deve ser booleano`);
    }
    const id = item.id === undefined ? randomUUID() : item.id;
    if (typeof id !== "string" || !id.trim() || id.trim().length > 80 || ids.has(id.trim())) {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field}.id deve ser único e ter entre 1 e 80 caracteres`);
    }
    ids.add(id.trim());
    if (item.parentId !== undefined && (typeof item.parentId !== "string" || item.parentId.length > 80)) {
      throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field}.parentId deve ser um ID de até 80 caracteres`);
    }
    const parentId = typeof item.parentId === "string" ? item.parentId.trim() : "";
    return {
      id: id.trim(),
      title: item.title.trim(),
      description: typeof item.description === "string" ? item.description.trim() : "",
      ...(item.hideDescription === true ? { hideDescription: true } : {}),
      ...(parentId ? { parentId } : {}),
    };
  });
  const hierarchyError = catalogHierarchyError(items);
  if (hierarchyError) throw httpError(422, "INVALID_DOCUMENT_DETAILS", hierarchyError);
  return items;
}
