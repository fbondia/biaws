import { Columns3, ListTree } from "lucide-react";

import { useResourceCollectionNavigator } from "../hooks/useResourceCollectionNavigator.js";
import { CollectionColumns } from "./CollectionColumns.jsx";
import { CollectionTree } from "./CollectionTree.jsx";

export function ResourceCollectionNavigator({
  canDragItem = () => true,
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
  const viewProps = {
    ...navigator,
    canDragItem,
    draggedItem,
    getItemId,
    onCreate,
    onDelete,
    onDeleteItem,
    onDragCollection,
    onDragEnd,
    onDragItem,
    onRename,
    onSelect,
    onSelectItem,
    renderItem,
    selectedCollectionId,
    selectedItemId,
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
