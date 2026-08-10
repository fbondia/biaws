import { GripVertical, Trash2 } from "lucide-react";

export function CollectionItemNode({
  active,
  canDrag,
  canDrop,
  dropActive,
  getItemId,
  item,
  onDragEnd,
  onDragItem,
  onDragOverItem,
  onDeleteItem,
  onSelectItem,
  onDropItem,
  renderItem,
  viewMode,
}) {
  const itemId = getItemId(item);
  const content = renderItem
    ? renderItem(item, { viewMode })
    : item.name || item.title || itemId;

  return (
    <div
      className={[
        "resourceCollectionItemRow",
        viewMode === "columns" ? "resourceCollectionColumnItemRow" : "",
        active ? "selectedResourceCollectionItem" : "",
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
        <button
          className="resourceCollectionItemContent"
          onClick={() => onSelectItem(item)}
          type="button"
        >
          {content}
        </button>
      ) : (
        <div className="resourceCollectionItemContent">{content}</div>
      )}
      {onDeleteItem ? (
        <button
          aria-label={`Excluir ${item.name || item.title || itemId}`}
          className="resourceCollectionActionButton"
          onClick={() => onDeleteItem(item)}
          title="Excluir"
          type="button"
        >
          <Trash2 size={13} />
        </button>
      ) : null}
    </div>
  );
}
