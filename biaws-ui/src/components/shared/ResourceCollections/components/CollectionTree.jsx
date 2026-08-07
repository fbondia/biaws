import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";

import { descendantCollectionIds } from "../model.js";
import { CollectionAddForm } from "./CollectionAddForm.jsx";
import { CollectionItemNode } from "./CollectionItemNode.jsx";

function CollectionTreeNode({
  canDragItem,
  collection,
  childrenByParent,
  collapsedIds,
  draggedItem,
  dropTargetId,
  getItemId,
  itemsByCollection,
  onDragCollection,
  onDragEnd,
  onDragItem,
  onDragOverCollection,
  onDelete,
  onDrop,
  onRename,
  onSelect,
  onSelectItem,
  onToggle,
  itemCounts,
  renderItem,
  selectedCollectionId,
  selectedItemId,
  visited,
}) {
  if (visited.has(collection.id)) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(collection.id);
  const children = childrenByParent.get(collection.id) || [];
  const collectionItems = itemsByCollection.get(collection.id) || [];
  const hasContents = Boolean(children.length || collectionItems.length);
  const expanded = !collapsedIds.has(collection.id);
  const invalidCollectionDrop =
    draggedItem?.type === "collection" &&
    (draggedItem.id === collection.id ||
      descendantCollectionIds(childrenByParent, draggedItem.id).has(
        collection.id,
      ));
  const canDrop = Boolean(draggedItem) && !invalidCollectionDrop;

  return (
    <div className="procedureCollectionTreeBranch">
      <div
        className={[
          "procedureCollectionTreeRow",
          selectedCollectionId === collection.id
            ? "selectedProcedureCollection"
            : "",
          dropTargetId === collection.id ? "procedureCollectionDropTarget" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        draggable={Boolean(onDragCollection)}
        onDragEnd={onDragEnd}
        onDragStart={(event) => {
          if (!onDragCollection) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "text/plain",
            `collection:${collection.id}`,
          );
          onDragCollection(collection);
        }}
        onDragOver={(event) => {
          if (!canDrop) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onDragOverCollection(collection.id);
        }}
        onDrop={(event) => {
          if (!canDrop) return;
          event.preventDefault();
          event.stopPropagation();
          onDrop(collection.id);
        }}
      >
        <GripVertical
          aria-hidden="true"
          className="procedureCollectionDragHandle"
          size={14}
        />
        <button
          aria-label={
            expanded
              ? `Recolher ${collection.name}`
              : `Expandir ${collection.name}`
          }
          className="procedureCollectionExpandButton"
          disabled={!hasContents}
          onClick={() => onToggle(collection.id)}
          type="button"
        >
          {hasContents ? (
            expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span />
          )}
        </button>
        <button
          className="procedureCollectionSelectButton"
          onClick={() => onSelect(collection.id)}
          title={collection.name}
          type="button"
        >
          {expanded && hasContents ? (
            <FolderOpen size={16} />
          ) : (
            <Folder size={16} />
          )}
          <span>{collection.name}</span>
          <small>{itemCounts[collection.id] || 0}</small>
        </button>
        <div className="procedureCollectionRowActions">
          {selectedCollectionId === collection.id && onRename ? (
            <button
              aria-label={`Editar coleção ${collection.name}`}
              className="procedureCollectionEditButton"
              onClick={() => onRename(collection)}
              title="Editar coleção"
              type="button"
            >
              <Pencil size={13} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              aria-label={`Excluir coleção ${collection.name}`}
              className="procedureCollectionDeleteButton"
              onClick={() => onDelete(collection)}
              title="Excluir coleção vazia"
              type="button"
            >
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {expanded && (children.length || collectionItems.length) ? (
        <div className="procedureCollectionTreeChildren">
          {children.map((child) => (
            <CollectionTreeNode
              canDragItem={canDragItem}
              childrenByParent={childrenByParent}
              collapsedIds={collapsedIds}
              collection={child}
              draggedItem={draggedItem}
              dropTargetId={dropTargetId}
              getItemId={getItemId}
              itemsByCollection={itemsByCollection}
              key={child.id}
              onDelete={onDelete}
              onDragCollection={onDragCollection}
              onDragEnd={onDragEnd}
              onDragItem={onDragItem}
              onDragOverCollection={onDragOverCollection}
              onDrop={onDrop}
              onRename={onRename}
              onSelect={onSelect}
              onSelectItem={onSelectItem}
              onToggle={onToggle}
              itemCounts={itemCounts}
              renderItem={renderItem}
              selectedCollectionId={selectedCollectionId}
              selectedItemId={selectedItemId}
              visited={nextVisited}
            />
          ))}
          {collectionItems.map((item) => (
            <CollectionItemNode
              active={selectedItemId === getItemId(item)}
              canDrag={Boolean(onDragItem) && canDragItem(item)}
              getItemId={getItemId}
              item={item}
              key={getItemId(item)}
              onDragEnd={onDragEnd}
              onDragItem={onDragItem}
              onSelectItem={onSelectItem}
              renderItem={renderItem}
              viewMode="tree"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CollectionTree({
  canDragItem,
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
  itemsByCollection,
  onCreate,
  onDelete,
  onDragCollection,
  onDragEnd,
  onDragItem,
  onRename,
  onSelect,
  onSelectItem,
  renderItem,
  selectedCollectionId,
  selectedItemId,
  setDropTargetId,
  toggleCollection,
  updateCollectionDraft,
}) {
  return (
    <div className="procedureCollectionTree">
      <div className="procedureCollectionTreeScroll">
        <div className="procedureCollectionTreeInner">
          {(childrenByParent.get("") || []).map((collection) => (
            <CollectionTreeNode
              canDragItem={canDragItem}
              childrenByParent={childrenByParent}
              collapsedIds={collapsedIds}
              collection={collection}
              draggedItem={draggedItem}
              dropTargetId={dropTargetId}
              getItemId={getItemId}
              itemsByCollection={itemsByCollection}
              key={collection.id}
              onDelete={onCreate ? onDelete : undefined}
              onDragCollection={onDragCollection}
              onDragEnd={() => finishDrag(onDragEnd)}
              onDragItem={onDragItem}
              onDragOverCollection={setDropTargetId}
              onDrop={dropAt}
              onRename={onRename}
              onSelect={onSelect}
              onSelectItem={onSelectItem}
              onToggle={toggleCollection}
              itemCounts={itemCounts}
              renderItem={renderItem}
              selectedCollectionId={selectedCollectionId}
              selectedItemId={selectedItemId}
              visited={new Set()}
            />
          ))}
          {(itemsByCollection.get("") || []).map((item) => (
            <CollectionItemNode
              active={selectedItemId === getItemId(item)}
              canDrag={Boolean(onDragItem) && canDragItem(item)}
              getItemId={getItemId}
              item={item}
              key={getItemId(item)}
              onDragEnd={onDragEnd}
              onDragItem={onDragItem}
              onSelectItem={onSelectItem}
              renderItem={renderItem}
              viewMode="tree"
            />
          ))}
        </div>
      </div>
      {onCreate ? (
        <CollectionAddForm
          disabled={creatingParentId === selectedCollectionId}
          error={
            creationError?.parentId === selectedCollectionId
              ? creationError.message
              : ""
          }
          name={collectionDrafts[selectedCollectionId] || ""}
          onChange={(name) => updateCollectionDraft(selectedCollectionId, name)}
          onSubmit={(event) => createAt(event, selectedCollectionId)}
        />
      ) : null}
    </div>
  );
}
