import { Columns3, FolderCheck, FolderSearch, ListTree } from "lucide-react";
import { createPortal } from "react-dom";

import { useResourceCollectionNavigator } from "../hooks/useResourceCollectionNavigator.js";
import { isItemReorderDrop } from "../model.js";
import { CollectionColumns } from "./CollectionColumns.jsx";
import { CollectionTree } from "./CollectionTree.jsx";
import { useResourceCollectionBarActionTargets } from "./ResourceCollectionBarActionsContext.js";

function CollectionFilterAction({ navigator }) {
  const filterLabel = navigator.showOnlyPopulated
    ? "Mostrar todas as coleções"
    : "Ocultar coleções sem itens";

  return (
    <button
      aria-label={filterLabel}
      aria-pressed={navigator.showOnlyPopulated}
      className={
        navigator.showOnlyPopulated
          ? "iconButton activeCollectionNavigationToggle"
          : "iconButton"
      }
      onClick={() => navigator.setShowOnlyPopulated((current) => !current)}
      title={filterLabel}
      type="button"
    >
      {navigator.showOnlyPopulated ? (
        <FolderCheck aria-hidden="true" size={16} />
      ) : (
        <FolderSearch aria-hidden="true" size={16} />
      )}
    </button>
  );
}

function ViewModeActions({ navigator }) {
  return (
    <div
      aria-label="Modo de visualização das coleções"
      className="resourceCollectionViewModeGroup"
      role="group"
    >
      <button
        aria-label="Visualizar em árvore"
        aria-pressed={navigator.viewMode === "tree"}
        className={
          navigator.viewMode === "tree"
            ? "iconButton activeCollectionNavigationToggle"
            : "iconButton"
        }
        onClick={() => navigator.setViewMode("tree")}
        title="Visualizar em árvore"
        type="button"
      >
        <ListTree aria-hidden="true" size={16} />
      </button>
      <button
        aria-label="Visualizar em colunas"
        aria-pressed={navigator.viewMode === "columns"}
        className={
          navigator.viewMode === "columns"
            ? "iconButton activeCollectionNavigationToggle"
            : "iconButton"
        }
        onClick={() => navigator.setViewMode("columns")}
        title="Visualizar em colunas"
        type="button"
      >
        <Columns3 aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

function NavigatorActions({ navigator }) {
  return (
    <div className="resourceCollectionNavigationActions">
      <CollectionFilterAction navigator={navigator} />
      <ViewModeActions navigator={navigator} />
    </div>
  );
}

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
  preferenceKey,
  renderItem,
}) {
  const barActionTargets = useResourceCollectionBarActionTargets();
  const navigator = useResourceCollectionNavigator({
    collections,
    items,
    onCreate,
    onDrop,
    onSelect,
    preferenceKey,
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
  const collectionFilterAction = (
    <CollectionFilterAction navigator={navigator} />
  );
  const viewModeActions = <ViewModeActions navigator={navigator} />;
  const actionsInBar = Boolean(
    barActionTargets?.collectionFilterTarget ||
    barActionTargets?.viewModeTarget,
  );

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
        {actionsInBar ? null : <NavigatorActions navigator={navigator} />}
      </header>

      {barActionTargets?.collectionFilterTarget
        ? createPortal(
            collectionFilterAction,
            barActionTargets.collectionFilterTarget,
          )
        : null}
      {barActionTargets?.viewModeTarget
        ? createPortal(viewModeActions, barActionTargets.viewModeTarget)
        : null}

      {navigator.viewMode === "tree" ? (
        <CollectionTree {...viewProps} />
      ) : (
        <CollectionColumns {...viewProps} />
      )}
    </aside>
  );
}
