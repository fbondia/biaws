import { Columns3, ListTree } from "lucide-react";

import { useResourceCollectionNavigator } from "../hooks/useResourceCollectionNavigator.js";
import { isItemReorderDrop } from "../model.js";
import { CollectionColumns } from "./CollectionColumns.jsx";
import { CollectionTree } from "./CollectionTree.jsx";

export function ResourceCollectionNavigator({
  canDragItem = () => true,
  canDropOnCollection = () => true,
  canReorderItem = () => true,
  className = "",
  collections,
  draggedItem,
  getItemId = (item) => item.id,
  items,
  onDragCollection,
  onDragEnd,
  onDragItem,
  onDelete,
  onDeleteItem,
  onDrop,
  onSelect,
  onSelectItem,
  selectedCollectionId,
  selectedItemId = "",
  itemLabel = "procedimentos",
  onCreate,
  onRename,
  onReorderItem,
  renderItem,
}) {
  const navigator = useResourceCollectionNavigator({
    collections,
    items,
    onCreate,
    onDrop,
    onSelect,
    selectedCollectionId,
  });

  function canDropOnItem(item) {
    return (
      Boolean(onReorderItem) &&
      isItemReorderDrop(draggedItem, item, getItemId) &&
      canReorderItem(draggedItem, item)
    );
  }

  function dragOverItem(item) {
    navigator.setDropTargetId(null);
    navigator.setItemDropTargetId(getItemId(item));
  }

  function dropOnItem(item) {
    navigator.setDropTargetId(null);
    navigator.setItemDropTargetId(null);
    if (!canDropOnItem(item)) return;
    onReorderItem(draggedItem.id, item);
  }

  const viewProps = {
    ...navigator,
    canDragItem,
    canDropOnCollection,
    canDropOnItem,
    draggedItem,
    getItemId,
    onCreate,
    onDelete,
    onDeleteItem,
    onDragCollection,
    onDragEnd,
    onDragItem,
    onDragOverItem: dragOverItem,
    onRename,
    onDropItem: dropOnItem,
    onSelect,
    onSelectItem,
    renderItem,
    selectedCollectionId,
    selectedItemId,
    setDropTargetId: (collectionId) => {
      navigator.setItemDropTargetId(null);
      navigator.setDropTargetId(collectionId);
    },
  };

  return (
    <aside
      className={["resourceCollectionsPanel", className]
        .filter(Boolean)
        .join(" ")}
    >
      <header>
        <div>
          <strong>Coleções</strong>
          <span>Arraste {itemLabel} e coleções para organizar.</span>
        </div>
        <button
          aria-label={
            navigator.viewMode === "tree"
              ? "Usar navegação em colunas"
              : "Usar navegação em árvore"
          }
          aria-pressed={navigator.viewMode === "columns"}
          className="iconButton resourceCollectionViewModeToggle"
          onClick={() =>
            navigator.setViewMode((current) =>
              current === "tree" ? "columns" : "tree",
            )
          }
          title={
            navigator.viewMode === "tree"
              ? "Visualizar em colunas"
              : "Visualizar árvore"
          }
          type="button"
        >
          {navigator.viewMode === "tree" ? (
            <Columns3 aria-hidden="true" size={15} />
          ) : (
            <ListTree aria-hidden="true" size={15} />
          )}
        </button>
      </header>

      {navigator.viewMode === "tree" ? (
        <CollectionTree {...viewProps} />
      ) : (
        <CollectionColumns {...viewProps} />
      )}
    </aside>
  );
}
