import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";

import { IllustratedEmptyState } from "../../IllustratedEmptyState.jsx";
import { descendantCollectionIds } from "../model.js";
import { CollectionAddForm } from "./CollectionAddForm.jsx";
import { CollectionItemNode } from "./CollectionItemNode.jsx";

function CollectionColumnRow({
  active,
  canDropOnCollection,
  collection,
  childrenByParent,
  draggedItem,
  dropTargetId,
  onDelete,
  onDragCollection,
  onDragEnd,
  onDragOverCollection,
  onDrop,
  onRename,
  onSelect,
  itemCounts,
}) {
  const children = childrenByParent.get(collection.id) || [];
  const invalidCollectionDrop =
    draggedItem?.type === "collection" &&
    (draggedItem.id === collection.id ||
      descendantCollectionIds(childrenByParent, draggedItem.id).has(
        collection.id,
      ));
  const canDrop =
    Boolean(draggedItem) &&
    !invalidCollectionDrop &&
    canDropOnCollection(draggedItem, collection);

  return (
    <div
      aria-selected={active}
      className={[
        "resourceCollectionColumnRow",
        active ? "selectedResourceCollection" : "",
        dropTargetId === collection.id ? "resourceCollectionDropTarget" : "",
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
        event.dataTransfer.setData("text/plain", `collection:${collection.id}`);
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
      role="treeitem"
    >
      <GripVertical
        aria-hidden="true"
        className="resourceCollectionDragHandle"
        size={14}
      />
      <button
        className="resourceCollectionColumnSelectButton"
        onClick={() => onSelect(collection.id)}
        title={collection.name}
        type="button"
      >
        {active && children.length ? (
          <FolderOpen size={16} />
        ) : (
          <Folder size={16} />
        )}
        <span>{collection.name}</span>
        {/*<small>{itemCounts[collection.id] || 0}</small>*/}
      </button>
      {/*children.length ? (
        <ChevronRight
          aria-label={`${children.length} ${children.length === 1 ? "subcoleção" : "subcoleções"}`}
          className="resourceCollectionColumnChevron"
          size={15}
        />
      ) : (
        <span />
      )*/}
      {active && (
        <div className="resourceCollectionRowActions">
          {onRename ? (
            <button
              aria-label={`Editar coleção ${collection.name}`}
              className="resourceCollectionActionButton"
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
              className="resourceCollectionActionButton"
              onClick={() => onDelete(collection)}
              title="Excluir coleção vazia"
              type="button"
            >
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CollectionColumns({
  canDragItem,
  canDropOnCollection,
  canDropOnItem,
  childrenByParent,
  collectionDrafts,
  columnNavigation,
  columnsRef,
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
  renderItem,
  selectedCollectionId,
  selectedItemId,
  setDropTargetId,
  updateCollectionDraft,
}) {
  return (
    <div className="resourceCollectionColumns" ref={columnsRef} role="tree">
      {columnNavigation.columns.map((column, columnIndex) => (
        <div
          className="resourceCollectionColumn"
          key={`${column.parentId || "root"}-${columnIndex}`}
          role="group"
        >
          <div className="resourceCollectionColumnList">
            {column.collections.map((collection) => (
              <CollectionColumnRow
                active={
                  columnNavigation.activePath[columnIndex] === collection.id
                }
                canDropOnCollection={canDropOnCollection}
                childrenByParent={childrenByParent}
                collection={collection}
                draggedItem={draggedItem}
                dropTargetId={dropTargetId}
                itemCounts={itemCounts}
                key={collection.id}
                onDelete={onCreate ? onDelete : undefined}
                onDragCollection={onDragCollection}
                onDragEnd={() => finishDrag(onDragEnd)}
                onDragOverCollection={setDropTargetId}
                onDrop={dropAt}
                onRename={
                  selectedCollectionId === collection.id ? onRename : undefined
                }
                onSelect={onSelect}
              />
            ))}

            {(itemsByCollection.get(column.parentId) || []).map((item) => (
              <CollectionItemNode
                active={selectedItemId === getItemId(item)}
                canDrag={Boolean(onDragItem) && canDragItem(item)}
                canDrop={canDropOnItem(item)}
                dropActive={itemDropTargetId === getItemId(item)}
                getItemId={getItemId}
                item={item}
                key={getItemId(item)}
                onDragEnd={() => finishDrag(onDragEnd)}
                onDragItem={onDragItem}
                onDragOverItem={onDragOverItem}
                onDeleteItem={onDeleteItem}
                onSelectItem={onSelectItem}
                onDropItem={onDropItem}
                renderItem={renderItem}
                viewMode="columns"
              />
            ))}

            {!column.collections.length &&
            !(itemsByCollection.get(column.parentId) || []).length ? (
              columnIndex === 0 ? (
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
              ) : (
                <p className="resourceCollectionColumnEmpty">
                  Nenhuma subcoleção
                </p>
              )
            ) : null}
          </div>
          {onCreate ? (
            <CollectionAddForm
              disabled={creatingParentId === column.parentId}
              error={
                creationError?.parentId === column.parentId
                  ? creationError.message
                  : ""
              }
              name={collectionDrafts[column.parentId] || ""}
              onChange={(name) => updateCollectionDraft(column.parentId, name)}
              onSubmit={(event) => createAt(event, column.parentId)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
