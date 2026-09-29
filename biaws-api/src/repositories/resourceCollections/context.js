import { httpError } from "./support.js";

export async function assertParent(
  collection,
  { parentId, movingId = "", workspaceId: currentWorkspaceId, resourceType },
) {
  if (!parentId) return;
  if (parentId === movingId) {
    throw httpError(
      422,
      "INVALID_COLLECTION_PARENT",
      "Uma coleção não pode ser movida para dentro dela mesma",
    );
  }
  const visited = new Set();
  let currentId = parentId;
  while (currentId) {
    if (visited.has(currentId) || currentId === movingId) {
      throw httpError(
        422,
        "INVALID_COLLECTION_PARENT",
        "Uma coleção não pode ser movida para dentro de uma subcoleção própria",
      );
    }
    visited.add(currentId);
    const current = await collection.findOne({
      id: currentId,
      workspaceId: currentWorkspaceId,
      resourceType,
    });
    if (!current) {
      throw httpError(
        422,
        "COLLECTION_PARENT_NOT_FOUND",
        `Coleção pai não encontrada: ${currentId}`,
      );
    }
    currentId = String(current.parentId || "").trim();
  }
}
