import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Pencil,
  FolderPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { IllustratedEmptyState } from "../../../IllustratedEmptyState.jsx";
import { descendantCollectionIds } from "../../model.js";
import { CollectionAddForm } from "../CollectionAddForm.jsx";
import { CollectionItemNode } from "../CollectionItemNode.jsx";
import { CollectionTreeNode } from "./components/CollectionTreeNode.jsx";

export function CollectionTree({
  canDragItem,
  canDropOnCollection,
  canDropOnItem,
  childrenByParent,
  collapsedIds,
  collectionDrafts,
  createAt,
  creatingParentId,
  creationError,
  draggedItem,
  dropAt,
  dropTargetId,
  finishDrag,
  getItemId,
  itemCounts,
  itemDropTargetId,
  itemsByCollection,
  onArchiveItem,
  onCreate,
  onDelete,
  onDeleteItem,
  onDragCollection,
  onDragEnd,
  onDragItem,
  onDragOverItem,
  onRename,
  onDropItem,
  onSelect,
  onSelectItem,
  onRestoreItem,
  renderItem,
  selectedCollectionId,
  selectedItemId,
  setDropTargetId,
  toggleCollection,
  updateCollectionDraft,
}) {
  const [addingParentId, setAddingParentId] = useState(null);

  return (
    <div className="resourceCollectionTree">
      <div className="resourceCollectionTreeScroll">
        <div className="resourceCollectionTreeInner">
          {!(childrenByParent.get("") || []).length &&
          !(itemsByCollection.get("") || []).length ? (
            <IllustratedEmptyState
              className="resourceCollectionNavigatorEmpty"
              compact
              description={
                onCreate
                  ? "Crie uma coleção para começar a organizar os itens."
                  : "Os itens e coleções aparecerão aqui."
              }
              icon={FolderPlus}
              title="Nada cadastrado ainda"
            />
          ) : null}
          {(childrenByParent.get("") || []).map((collection) => (
            <CollectionTreeNode
              addingParentId={addingParentId}
              canDragItem={canDragItem}
              canDropOnCollection={canDropOnCollection}
              canDropOnItem={canDropOnItem}
              childrenByParent={childrenByParent}
              collapsedIds={collapsedIds}
              collection={collection}
              collectionDrafts={collectionDrafts}
              createAt={onCreate ? createAt : undefined}
              creatingParentId={creatingParentId}
              creationError={creationError}
              draggedItem={draggedItem}
              dropTargetId={dropTargetId}
              getItemId={getItemId}
              itemDropTargetId={itemDropTargetId}
              itemsByCollection={itemsByCollection}
              onArchiveItem={onArchiveItem}
              key={collection.id}
              onDelete={onCreate ? onDelete : undefined}
              onDeleteItem={onDeleteItem}
              onDragCollection={onDragCollection}
              onDragEnd={() => finishDrag(onDragEnd)}
              onDragItem={onDragItem}
              onDragOverItem={onDragOverItem}
              onDragOverCollection={setDropTargetId}
              onDrop={dropAt}
              onDropItem={onDropItem}
              onRename={onRename}
              onSelect={onSelect}
              onSelectItem={onSelectItem}
              onRestoreItem={onRestoreItem}
              onToggle={toggleCollection}
              itemCounts={itemCounts}
              renderItem={renderItem}
              setAddingParentId={setAddingParentId}
              selectedCollectionId={selectedCollectionId}
              selectedItemId={selectedItemId}
              updateCollectionDraft={updateCollectionDraft}
              visited={new Set()}
            />
          ))}
          {(itemsByCollection.get("") || []).map((item) => (
            <CollectionItemNode
              active={selectedItemId === getItemId(item)}
              canDrag={Boolean(onDragItem) && canDragItem(item)}
              canDrop={canDropOnItem(item)}
              dropActive={itemDropTargetId === getItemId(item)}
              getItemId={getItemId}
              item={item}
              key={getItemId(item)}
              onArchiveItem={onArchiveItem}
              onDragEnd={() => finishDrag(onDragEnd)}
              onDragItem={onDragItem}
              onDragOverItem={onDragOverItem}
              onDeleteItem={onDeleteItem}
              onSelectItem={onSelectItem}
              onRestoreItem={onRestoreItem}
              onDropItem={onDropItem}
              renderItem={renderItem}
              viewMode="tree"
            />
          ))}
        </div>
      </div>
      {onCreate ? (
        <CollectionAddForm
          disabled={creatingParentId === ""}
          error={creationError?.parentId === "" ? creationError.message : ""}
          name={collectionDrafts[""] || ""}
          onChange={(name) => updateCollectionDraft("", name)}
          onSubmit={(event) => createAt(event, "")}
        />
      ) : null}
    </div>
  );
}
