import { MAX_REFERENCES, MAX_RELATIONSHIP } from "./constants.js";
import { httpError } from "./support.js";
import { DOCUMENT_TYPES } from "./types.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";

export function normalizeReferences(value, current = []) {
  if (value === undefined) return current || [];
  if (!Array.isArray(value) || value.length > MAX_REFERENCES) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_REFERENCES",
      `references deve ser um array com no máximo ${MAX_REFERENCES} itens`,
    );
  }
  const seen = new Set();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw httpError(
        422,
        "INVALID_DOCUMENT_REFERENCES",
        `references[${index}] é inválida`,
      );
    }
    const targetDocumentId = String(entry.targetDocumentId || "").trim();
    const relationship = String(entry.relationship || "related").trim();
    if (
      !targetDocumentId ||
      !relationship ||
      relationship.length > MAX_RELATIONSHIP
    ) {
      throw httpError(
        422,
        "INVALID_DOCUMENT_REFERENCES",
        `references[${index}] requer targetDocumentId e relationship válidos`,
      );
    }
    const key = `${targetDocumentId}:${relationship}`;
    if (seen.has(key)) {
      throw httpError(
        422,
        "DUPLICATE_DOCUMENT_REFERENCE",
        `Referência duplicada: ${key}`,
      );
    }
    seen.add(key);
    return { targetDocumentId, relationship };
  });
}

export async function validateReferences(
  db,
  references,
  workspaceId,
  authorizationScope,
  ownId = "",
) {
  for (const reference of references) {
    if (reference.targetDocumentId === ownId) {
      throw httpError(
        422,
        "SELF_DOCUMENT_REFERENCE",
        "Um documento não pode referenciar a si mesmo",
      );
    }
    const target = await db.collection(COLLECTION_NAMES.DOCUMENTS).findOne({
      id: reference.targetDocumentId,
      workspaceId,
      documentType: { $in: Object.keys(DOCUMENT_TYPES) },
      ...(authorizationScope?.workspace === true
        ? {}
        : { applicationId: { $in: authorizationScope?.applicationIds || [] } }),
    });
    if (!target) {
      throw httpError(
        422,
        "DOCUMENT_REFERENCE_NOT_FOUND",
        `Documento referenciado não encontrado: ${reference.targetDocumentId}`,
      );
    }
  }
}
