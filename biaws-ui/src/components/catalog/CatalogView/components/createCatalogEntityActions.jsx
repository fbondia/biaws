import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";

import { hasPermission } from "../../../../permissions.js";

const ARCHIVE_ONLY_IN_EDIT_DIALOG = new Set([
  "component",
  "deployment",
  "runtime",
]);

export function createCatalogEntityActions({
  actor,
  archiveEntity,
  deleteEntity,
  editEntity,
  restoreEntity,
}) {
  return (kind, updatePermission, archivePermission) => (entity) => (
    <>
      {entity.status !== "archived" &&
      hasPermission(actor, updatePermission) ? (
        <button
          aria-label={`Editar ${entity.name}`}
          className="iconButton"
          onClick={() => editEntity(kind, entity)}
          title="Editar"
          type="button"
        >
          <Pencil size={15} />
        </button>
      ) : null}
      {!ARCHIVE_ONLY_IN_EDIT_DIALOG.has(kind) &&
      hasPermission(actor, archivePermission) &&
      entity.status !== "archived" ? (
        <button
          aria-label={`Arquivar ${entity.name}`}
          className="iconButton dangerIconButton"
          onClick={() => archiveEntity(kind, entity)}
          title="Arquivar"
          type="button"
        >
          <Archive size={15} />
        </button>
      ) : null}
      {hasPermission(actor, archivePermission) &&
      entity.status === "archived" ? (
        <>
          <button
            aria-label={`Desarquivar ${entity.name}`}
            className="iconButton"
            onClick={() => restoreEntity(kind, entity)}
            title="Desarquivar"
            type="button"
          >
            <ArchiveRestore size={15} />
          </button>
          <button
            aria-label={`Excluir definitivamente ${entity.name}`}
            className="iconButton dangerIconButton"
            onClick={() => deleteEntity(kind, entity)}
            title="Excluir definitivamente"
            type="button"
          >
            <Trash2 size={15} />
          </button>
        </>
      ) : null}
    </>
  );
}
