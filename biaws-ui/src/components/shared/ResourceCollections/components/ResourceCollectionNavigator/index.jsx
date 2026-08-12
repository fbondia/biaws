import { createPortal } from "react-dom";

import { useResourceCollectionNavigator } from "../../hooks/useResourceCollectionNavigator.js";
import { isItemReorderDrop } from "../../model.js";
import { CollectionColumns } from "../CollectionColumns.jsx";
import { CollectionTree } from "../CollectionTree.jsx";
import { useResourceCollectionBarActionTargets } from "../ResourceCollectionBar/index.jsx";
import { CollectionFilterAction } from "./components/CollectionFilterAction.jsx";
import { ResourceCollectionNavigatorHeader } from "./components/ResourceCollectionNavigatorHeader.jsx";
import { ViewModeAction } from "./components/ViewModeAction.jsx";

export function ResourceCollectionNavigator({
  canDragItem = () => true,
  canDropOnCollection = () => true,
  canReorderItem = () => true,
  className = "",
  collections,
  draggedItem,
  getItemId = (item) => item.id,
  items,
  onArchiveItem,
  onDragCollection,
  onDragEnd,
  onDragItem,
  onDelete,
  onDeleteItem,
  onDrop,
  onSelect,
  onSelectItem,
  onRestoreItem,
  selectedCollectionId,
  selectedItemId = "",
  itemLabel = "procedimentos",
  onCreate,
  onRename,
  onReorderItem,
  preferenceKey,
  renderItem,
  workspaceId,
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
    workspaceId,
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
    onArchiveItem,
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
    onRestoreItem,
    renderItem,
    selectedCollectionId,
    selectedItemId,
    setDropTargetId: (collectionId) => {
      navigator.setItemDropTargetId(null);
      navigator.setDropTargetId(collectionId);
    },
  };
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
      <ResourceCollectionNavigatorHeader
        actionsInBar={actionsInBar}
        itemLabel={itemLabel}
        navigator={navigator}
      />

      {barActionTargets?.viewModeTarget
        ? createPortal(
            <ViewModeAction navigator={navigator} />,
            barActionTargets.viewModeTarget,
          )
        : null}
      {barActionTargets?.collectionFilterTarget
        ? createPortal(
            <CollectionFilterAction navigator={navigator} />,
            barActionTargets.collectionFilterTarget,
          )
        : null}

      {navigator.viewMode === "tree" ? (
        <CollectionTree {...viewProps} />
      ) : (
        <CollectionColumns {...viewProps} />
      )}
    </aside>
  );
}
