import { Archive, ArchiveRestore, GripVertical, Trash2 } from "lucide-react";

import { collectionItemLifecycleActions } from "../model.js";

export function CollectionItemNode({
  active,
  canDrag,
  canDrop,
  dropActive,
  getItemId,
  item,
  onArchiveItem,
  onDragEnd,
  onDragItem,
  onDragOverItem,
  onDeleteItem,
  onSelectItem,
  onDropItem,
  onRestoreItem,
  renderItem,
  viewMode,
}) {
  const itemId = getItemId(item);
  const archived = item.status === "archived";
  const content = renderItem
    ? renderItem(item, { viewMode })
    : item.name || item.title || itemId;
  const archivedBadge = archived ? (
    <span className="resourceCollectionArchivedBadge">
      <Archive aria-hidden="true" size={10} />
      Arquivado
    </span>
  ) : null;
  const lifecycleActions = collectionItemLifecycleActions(item, {
    onArchiveItem,
    onDeleteItem,
    onRestoreItem,
  });
  const hasLifecycleActions = Object.values(lifecycleActions).some(Boolean);

  return (
    <div
      className={[
        "resourceCollectionItemRow",
        viewMode === "columns" ? "resourceCollectionColumnItemRow" : "",
        active ? "selectedResourceCollectionItem" : "",
        archived ? "resourceCollectionArchivedItem" : "",
        dropActive ? "resourceCollectionDropTarget" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={canDrag}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOverItem(item);
      }}
      onDragStart={(event) => {
        if (!canDrag || !onDragItem) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `item:${itemId}`);
        onDragItem(item);
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.stopPropagation();
        onDropItem(item);
      }}
      role="treeitem"
    >
      {canDrag ? (
        <GripVertical
          aria-hidden="true"
          className="resourceCollectionDragHandle"
          size={12}
        />
      ) : (
        <span className="resourceCollectionItemSpacer" />
      )}
      {onSelectItem ? (
        <div className="resourceCollectionItemContent">
          <button
            aria-label={`Abrir ${item.name || item.title || itemId}`}
            className="resourceCollectionItemOpenButton"
            onClick={() => onSelectItem(item)}
            type="button"
          />
          {content}
          {archivedBadge}
        </div>
      ) : (
        <div className="resourceCollectionItemContent">
          {content}
          {archivedBadge}
        </div>
      )}
      {hasLifecycleActions ? (
        <div className="resourceCollectionItemActions">
          {lifecycleActions.archive ? (
            <button
              aria-label={`Arquivar ${item.name || item.title || itemId}`}
              className="resourceCollectionActionButton"
              onClick={() => onArchiveItem(item)}
              title="Arquivar"
              type="button"
            >
              <Archive size={13} />
            </button>
          ) : null}
          {lifecycleActions.restore ? (
            <button
              aria-label={`Desarquivar ${item.name || item.title || itemId}`}
              className="resourceCollectionActionButton resourceCollectionRestoreButton"
              onClick={() => onRestoreItem(item)}
              title="Desarquivar"
              type="button"
            >
              <ArchiveRestore size={13} />
            </button>
          ) : null}
          {lifecycleActions.delete ? (
            <button
              aria-label={`Excluir definitivamente ${item.name || item.title || itemId}`}
              className="resourceCollectionActionButton"
              onClick={() => onDeleteItem(item)}
              title="Excluir definitivamente"
              type="button"
            >
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
