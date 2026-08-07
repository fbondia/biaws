import { GripVertical } from "lucide-react";

export function CollectionItemNode({
  active,
  canDrag,
  getItemId,
  item,
  onDragEnd,
  onDragItem,
  onSelectItem,
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
        "procedureCollectionItemRow",
        viewMode === "columns" ? "procedureCollectionColumnItemRow" : "",
        active ? "selectedResourceCollectionItem" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={canDrag}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        if (!canDrag || !onDragItem) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `item:${itemId}`);
        onDragItem(item);
      }}
      role="treeitem"
    >
      {canDrag ? (
        <GripVertical
          aria-hidden="true"
          className="procedureCollectionDragHandle"
          size={12}
        />
      ) : (
        <span className="procedureCollectionItemSpacer" />
      )}
      {onSelectItem ? (
        <button
          className="procedureCollectionItemContent"
          onClick={() => onSelectItem(item)}
          type="button"
        >
          {content}
        </button>
      ) : (
        <div className="procedureCollectionItemContent">{content}</div>
      )}
    </div>
  );
}
