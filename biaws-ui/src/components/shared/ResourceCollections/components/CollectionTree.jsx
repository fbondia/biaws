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

import { IllustratedEmptyState } from "../../IllustratedEmptyState.jsx";
import { descendantCollectionIds } from "../model.js";
import { CollectionAddForm } from "./CollectionAddForm.jsx";
import { CollectionItemNode } from "./CollectionItemNode.jsx";

function CollectionTreeNode({
  addingParentId,
  canDragItem,
  canDropOnCollection,
  canDropOnItem,
  collection,
  collectionDrafts,
  createAt,
  creatingParentId,
  creationError,
  childrenByParent,
  collapsedIds,
  draggedItem,
  dropTargetId,
  getItemId,
  itemDropTargetId,
  itemsByCollection,
  onDragCollection,
  onDragEnd,
  onDragItem,
  onDragOverItem,
  onDragOverCollection,
  onDelete,
  onDeleteItem,
  onDrop,
  onDropItem,
  onRename,
  onSelect,
  onSelectItem,
  onToggle,
  itemCounts,
  renderItem,
  setAddingParentId,
  selectedCollectionId,
  selectedItemId,
  updateCollectionDraft,
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
  const canDrop =
    Boolean(draggedItem) &&
    !invalidCollectionDrop &&
    canDropOnCollection(draggedItem, collection);
  const addingSubcollection = addingParentId === collection.id;

  function toggleSubcollectionForm() {
    setAddingParentId((current) =>
      current === collection.id ? null : collection.id,
    );
    if (!expanded) onToggle(collection.id);
  }

  async function createSubcollection(event) {
    const created = await createAt(event, collection.id);
    if (created) setAddingParentId(null);
  }

  return (
    <div className="resourceCollectionTreeBranch">
      <div
        className={[
          "resourceCollectionTreeRow",
          selectedCollectionId === collection.id
            ? "selectedResourceCollection"
            : "",
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
          className="resourceCollectionDragHandle"
          size={14}
        />
        <button
          aria-label={
            expanded
              ? `Recolher ${collection.name}`
              : `Expandir ${collection.name}`
          }
          className="resourceCollectionExpandButton"
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
          className="resourceCollectionSelectButton"
          onClick={() => {
            onToggle(collection.id);
            onSelect(collection.id);
          }}
          title={collection.name}
          type="button"
        >
          {expanded && hasContents ? (
            <FolderOpen size={16} />
          ) : (
            <Folder size={16} />
          )}
          <span>{collection.name}</span>
          {/*<small>{itemCounts[collection.id] || 0}</small>*/}
        </button>

        {selectedCollectionId === collection.id && (
          <div className="procedureCollectionRowActions">
            {createAt ? (
              <button
                aria-expanded={addingSubcollection}
                aria-label={`Criar subcoleção em ${collection.name}`}
                className={
                  addingSubcollection
                    ? "resourceCollectionActionButton activeCollectionAction"
                    : "resourceCollectionActionButton"
                }
                onClick={toggleSubcollectionForm}
                title="Criar subcoleção"
                type="button"
              >
                <FolderPlus size={13} />
              </button>
            ) : null}
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

      {addingSubcollection ? (
        <div className="resourceCollectionTreeChildAdd">
          <CollectionAddForm
            autoFocus
            disabled={creatingParentId === collection.id}
            error={
              creationError?.parentId === collection.id
                ? creationError.message
                : ""
            }
            name={collectionDrafts[collection.id] || ""}
            onChange={(name) => updateCollectionDraft(collection.id, name)}
            onSubmit={createSubcollection}
          />
        </div>
      ) : null}

      {expanded && (children.length || collectionItems.length) ? (
        <div className="resourceCollectionTreeChildren">
          {children.map((child) => (
            <CollectionTreeNode
              addingParentId={addingParentId}
              canDragItem={canDragItem}
              canDropOnCollection={canDropOnCollection}
              canDropOnItem={canDropOnItem}
              childrenByParent={childrenByParent}
              collapsedIds={collapsedIds}
              collection={child}
              collectionDrafts={collectionDrafts}
              createAt={createAt}
              creatingParentId={creatingParentId}
              creationError={creationError}
              draggedItem={draggedItem}
              dropTargetId={dropTargetId}
              getItemId={getItemId}
              itemDropTargetId={itemDropTargetId}
              itemsByCollection={itemsByCollection}
              key={child.id}
              onDelete={onDelete}
              onDeleteItem={onDeleteItem}
              onDragCollection={onDragCollection}
              onDragEnd={onDragEnd}
              onDragItem={onDragItem}
              onDragOverItem={onDragOverItem}
              onDragOverCollection={onDragOverCollection}
              onDrop={onDrop}
              onDropItem={onDropItem}
              onRename={onRename}
              onSelect={onSelect}
              onSelectItem={onSelectItem}
              onToggle={onToggle}
              itemCounts={itemCounts}
              renderItem={renderItem}
              setAddingParentId={setAddingParentId}
              selectedCollectionId={selectedCollectionId}
              selectedItemId={selectedItemId}
              updateCollectionDraft={updateCollectionDraft}
              visited={nextVisited}
            />
          ))}
          {collectionItems.map((item) => (
            <CollectionItemNode
              active={selectedItemId === getItemId(item)}
              canDrag={Boolean(onDragItem) && canDragItem(item)}
              canDrop={canDropOnItem(item)}
              dropActive={itemDropTargetId === getItemId(item)}
              getItemId={getItemId}
              item={item}
              key={getItemId(item)}
              onDragEnd={onDragEnd}
              onDragItem={onDragItem}
              onDragOverItem={onDragOverItem}
              onDeleteItem={onDeleteItem}
              onSelectItem={onSelectItem}
              onDropItem={onDropItem}
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
              onDragEnd={() => finishDrag(onDragEnd)}
              onDragItem={onDragItem}
              onDragOverItem={onDragOverItem}
              onDeleteItem={onDeleteItem}
              onSelectItem={onSelectItem}
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
