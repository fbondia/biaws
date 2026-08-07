import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  ListTree,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const COLLECTION_SIDEBAR_MIN_WIDTH = 220;
const COLLECTION_SIDEBAR_MAX_WIDTH = 640;
const COLLECTION_CONTENT_MIN_WIDTH = 320;

function sortCollections(items) {
  return [...items].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }),
  );
}

export function buildCollectionTree(collections = []) {
  const knownIds = new Set(collections.map(({ id }) => id));
  const childrenByParent = new Map();

  for (const collection of collections) {
    const parentId = knownIds.has(collection.parentId)
      ? collection.parentId
      : "";
    const children = childrenByParent.get(parentId) || [];
    children.push(collection);
    childrenByParent.set(parentId, children);
  }

  for (const [parentId, children] of childrenByParent) {
    childrenByParent.set(parentId, sortCollections(children));
  }

  return childrenByParent;
}

export function collectionPathLabel(collections = [], collectionId = "") {
  if (!collectionId) return "Raiz";
  const byId = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const path = [];
  const visited = new Set();
  let currentId = collectionId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const collection = byId.get(currentId);
    if (!collection) break;
    path.unshift(collection.name);
    currentId = collection.parentId;
  }

  return path.length ? path.join(" / ") : "Raiz";
}

export function ResourceCollectionsShell({
  children,
  className = "",
  collections,
  collectionsVisible = true,
  onShowCollections,
  pathLabel,
  selectedCollectionId,
  sidebar,
  toolbar,
}) {
  const layoutRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(270);
  const [resizingSidebar, setResizingSidebar] = useState(false);

  function clampSidebarWidth(width) {
    const layoutWidth = layoutRef.current?.getBoundingClientRect().width;
    const availableWidth = layoutWidth
      ? layoutWidth - COLLECTION_CONTENT_MIN_WIDTH
      : COLLECTION_SIDEBAR_MAX_WIDTH;
    const maximumWidth = Math.max(
      COLLECTION_SIDEBAR_MIN_WIDTH,
      Math.min(COLLECTION_SIDEBAR_MAX_WIDTH, availableWidth),
    );
    return Math.min(
      maximumWidth,
      Math.max(COLLECTION_SIDEBAR_MIN_WIDTH, width),
    );
  }

  function resizeSidebar(clientX) {
    const layoutLeft = layoutRef.current?.getBoundingClientRect().left;
    if (layoutLeft === undefined) return;
    setSidebarWidth(clampSidebarWidth(clientX - layoutLeft));
  }

  return (
    <div
      className={[
        "resourceCollectionsLayout",
        className,
        !collectionsVisible ? "resourceCollectionsCollapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={layoutRef}
      style={{
        "--resource-collections-sidebar-width": `${sidebarWidth}px`,
      }}
    >
      {sidebar}
      {collectionsVisible && sidebar ? (
        <div
          aria-label="Redimensionar coluna de coleções"
          aria-orientation="vertical"
          aria-valuemax={COLLECTION_SIDEBAR_MAX_WIDTH}
          aria-valuemin={COLLECTION_SIDEBAR_MIN_WIDTH}
          aria-valuenow={sidebarWidth}
          className={[
            "resourceCollectionsResizer",
            resizingSidebar ? "resourceCollectionsResizing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onKeyDown={(event) => {
            let nextWidth;
            if (event.key === "ArrowLeft") nextWidth = sidebarWidth - 20;
            if (event.key === "ArrowRight") nextWidth = sidebarWidth + 20;
            if (event.key === "Home") nextWidth = COLLECTION_SIDEBAR_MIN_WIDTH;
            if (event.key === "End") nextWidth = COLLECTION_SIDEBAR_MAX_WIDTH;
            if (nextWidth === undefined) return;
            event.preventDefault();
            setSidebarWidth(clampSidebarWidth(nextWidth));
          }}
          onLostPointerCapture={() => setResizingSidebar(false)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setResizingSidebar(true);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            resizeSidebar(event.clientX);
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setResizingSidebar(false);
          }}
          role="separator"
          tabIndex={0}
          title="Arraste para redimensionar a coluna de coleções"
        />
      ) : null}
      <div className="resourceCollectionContent">
        <div className="resourceCollectionBar">
          <button
            aria-expanded={collectionsVisible}
            className="resourceCollectionPath"
            onClick={onShowCollections}
            title="Mostrar coleções"
            type="button"
          >
            {pathLabel ||
              collectionPathLabel(collections, selectedCollectionId)}
          </button>
          {toolbar}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ResourceCollectionSearch({
  additionalFilters,
  loading = false,
  onRefresh,
  onSearch,
  onSearchChange,
  placeholder = "Pesquisar...",
  search,
}) {
  return (
    <form
      className="resourceCollectionSearch"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch?.();
      }}
    >
      <label className="resourceCollectionSearchInput">
        <Search aria-hidden="true" size={15} />
        <span className="srOnly">Pesquisar</span>
        <input
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={search}
        />
      </label>
      {additionalFilters}
      <button
        aria-label="Pesquisar"
        className="iconButton"
        disabled={loading}
        title="Pesquisar"
        type="submit"
      >
        <Search size={16} />
      </button>
      <button
        aria-label="Atualizar"
        className="iconButton"
        disabled={loading}
        onClick={onRefresh}
        title="Atualizar"
        type="button"
      >
        <RefreshCw className={loading ? "spinIcon" : undefined} size={16} />
      </button>
    </form>
  );
}

function descendantCollectionIds(childrenByParent, collectionId) {
  const descendants = new Set();
  const pending = [...(childrenByParent.get(collectionId) || [])];

  while (pending.length) {
    const current = pending.pop();
    if (!current || descendants.has(current.id)) continue;
    descendants.add(current.id);
    pending.push(...(childrenByParent.get(current.id) || []));
  }

  return descendants;
}

function collectionIdPath(collections, collectionId) {
  if (!collectionId) return [];
  const byId = new Map(
    collections.map((collection) => [collection.id, collection]),
  );
  const path = [];
  const visited = new Set();
  let currentId = collectionId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const collection = byId.get(currentId);
    if (!collection) break;
    path.unshift(currentId);
    currentId = collection.parentId;
  }

  return path;
}

function buildCollectionColumns(collections, childrenByParent, collectionId) {
  const activePath = collectionIdPath(collections, collectionId);
  const columns = [
    { parentId: "", collections: childrenByParent.get("") || [] },
  ];

  for (const activeCollectionId of activePath) {
    columns.push({
      parentId: activeCollectionId,
      collections: childrenByParent.get(activeCollectionId) || [],
    });
  }

  return { activePath, columns };
}

function CollectionItemNode({
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
  procedureCounts,
  renderItem,
  selectedCollectionId,
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
          <small>{procedureCounts[collection.id] || 0}</small>
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
              childrenByParent={childrenByParent}
              canDragItem={canDragItem}
              collapsedIds={collapsedIds}
              collection={child}
              draggedItem={draggedItem}
              dropTargetId={dropTargetId}
              getItemId={getItemId}
              itemsByCollection={itemsByCollection}
              key={child.id}
              onDragCollection={onDragCollection}
              onDragEnd={onDragEnd}
              onDragItem={onDragItem}
              onDragOverCollection={onDragOverCollection}
              onDelete={onDelete}
              onDrop={onDrop}
              onRename={onRename}
              onSelect={onSelect}
              onSelectItem={onSelectItem}
              onToggle={onToggle}
              procedureCounts={procedureCounts}
              renderItem={renderItem}
              selectedCollectionId={selectedCollectionId}
              visited={nextVisited}
            />
          ))}
          {collectionItems.map((item) => (
            <CollectionItemNode
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

function CollectionColumnRow({
  active,
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
  procedureCounts,
}) {
  const children = childrenByParent.get(collection.id) || [];
  const invalidCollectionDrop =
    draggedItem?.type === "collection" &&
    (draggedItem.id === collection.id ||
      descendantCollectionIds(childrenByParent, draggedItem.id).has(
        collection.id,
      ));
  const canDrop = Boolean(draggedItem) && !invalidCollectionDrop;

  return (
    <div
      aria-selected={active}
      className={[
        "procedureCollectionColumnRow",
        active ? "selectedProcedureCollection" : "",
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
        className="procedureCollectionDragHandle"
        size={14}
      />
      <button
        className="procedureCollectionColumnSelectButton"
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
        <small>{procedureCounts[collection.id] || 0}</small>
      </button>
      {children.length ? (
        <ChevronRight
          aria-label={`${children.length} ${children.length === 1 ? "subcoleção" : "subcoleções"}`}
          className="procedureCollectionColumnChevron"
          size={15}
        />
      ) : (
        <span />
      )}
      <div className="procedureCollectionRowActions">
        {active && onRename ? (
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
  );
}

function CollectionAddForm({ disabled, error, name, onChange, onSubmit }) {
  return (
    <form className="procedureCollectionAdd" onSubmit={onSubmit}>
      {error ? <small role="alert">{error}</small> : null}
      <div>
        <input
          aria-label="Nome da nova coleção"
          disabled={disabled}
          maxLength={120}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nova coleção"
          value={name}
        />
        <button
          aria-label="Criar coleção"
          disabled={disabled || !name.trim()}
          title="Criar coleção"
          type="submit"
        >
          <Plus size={13} />
        </button>
      </div>
    </form>
  );
}

export function ResourceCollectionSidebar({
  canDragItem = () => true,
  collections,
  draggedItem,
  getItemId = (item) => item.id,
  items,
  onDragCollection,
  onDragEnd,
  onDragItem,
  onDelete,
  onDrop,
  onSelect,
  onSelectItem,
  selectedCollectionId,
  itemLabel = "procedimentos",
  onCreate,
  onClose,
  onRename,
  renderItem,
}) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [dropTargetId, setDropTargetId] = useState(null);
  const [viewMode, setViewMode] = useState("tree");
  const [collectionDrafts, setCollectionDrafts] = useState({});
  const [creatingParentId, setCreatingParentId] = useState(null);
  const [creationError, setCreationError] = useState(null);
  const columnsRef = useRef(null);
  const childrenByParent = useMemo(
    () => buildCollectionTree(collections),
    [collections],
  );
  const procedureCounts = useMemo(
    () =>
      items.reduce((counts, item) => {
        const collectionId = item.collectionId || "";
        counts[collectionId] = (counts[collectionId] || 0) + 1;
        return counts;
      }, {}),
    [items],
  );
  const itemsByCollection = useMemo(() => {
    const knownCollectionIds = new Set(
      collections.map((collection) => collection.id),
    );
    return items.reduce((groups, item) => {
      const requestedCollectionId = item.collectionId || "";
      const collectionId = knownCollectionIds.has(requestedCollectionId)
        ? requestedCollectionId
        : "";
      const groupedItems = groups.get(collectionId) || [];
      groupedItems.push(item);
      groups.set(collectionId, groupedItems);
      return groups;
    }, new Map());
  }, [collections, items]);
  const columnNavigation = useMemo(
    () =>
      buildCollectionColumns(
        collections,
        childrenByParent,
        selectedCollectionId,
      ),
    [childrenByParent, collections, selectedCollectionId],
  );

  useEffect(() => {
    if (viewMode !== "columns") return;
    const frame = requestAnimationFrame(() => {
      columnsRef.current?.scrollTo({
        behavior: "smooth",
        left: columnsRef.current.scrollWidth,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [columnNavigation.columns.length, selectedCollectionId, viewMode]);

  function dropAt(collectionId) {
    setDropTargetId(null);
    onDrop(collectionId);
  }

  async function createAt(event, parentId) {
    event.preventDefault();
    const name = (collectionDrafts[parentId] || "").trim();
    if (!name || !onCreate) return;

    setCreatingParentId(parentId);
    setCreationError(null);
    try {
      const collection = await onCreate(parentId, name);
      setCollectionDrafts((current) => ({ ...current, [parentId]: "" }));
      if (collection?.id) onSelect(collection.id);
    } catch (error) {
      setCreationError({ parentId, message: error.message });
    } finally {
      setCreatingParentId(null);
    }
  }

  function updateCollectionDraft(parentId, name) {
    setCollectionDrafts((current) => ({ ...current, [parentId]: name }));
    if (creationError?.parentId === parentId) setCreationError(null);
  }

  return (
    <aside className="procedureCollectionsPanel">
      <header>
        <div>
          <strong>Coleções</strong>
          <span>Arraste {itemLabel} e coleções para organizar.</span>
        </div>
        <button
          aria-label={
            viewMode === "tree"
              ? "Usar navegação em colunas"
              : "Usar navegação em árvore"
          }
          aria-pressed={viewMode === "columns"}
          className="iconButton resourceCollectionViewModeToggle"
          onClick={() =>
            setViewMode((current) => (current === "tree" ? "columns" : "tree"))
          }
          title={
            viewMode === "tree" ? "Visualizar em colunas" : "Visualizar árvore"
          }
          type="button"
        >
          {viewMode === "tree" ? (
            <Columns3 aria-hidden="true" size={15} />
          ) : (
            <ListTree aria-hidden="true" size={15} />
          )}
        </button>
        {onClose ? (
          <button
            aria-label="Ocultar coleções"
            className="iconButton resourceCollectionCloseButton"
            onClick={onClose}
            title="Ocultar coleções"
            type="button"
          >
            <X size={16} />
          </button>
        ) : null}
      </header>

      {viewMode === "tree" ? (
        <div className="procedureCollectionTree">
          <div className="procedureCollectionTreeScroll">
            <div className="procedureCollectionTreeInner">
              <div
                className={[
                  "procedureCollectionTreeRow",
                  "procedureCollectionRootRow",
                  !selectedCollectionId ? "selectedProcedureCollection" : "",
                  dropTargetId === "" ? "procedureCollectionDropTarget" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    setDropTargetId(null);
                }}
                onDragOver={(event) => {
                  if (!draggedItem) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTargetId("");
                }}
                onDrop={(event) => {
                  if (!draggedItem) return;
                  event.preventDefault();
                  dropAt("");
                }}
              >
                <span className="procedureCollectionRootSpacer" />
                <button
                  className="procedureCollectionSelectButton"
                  onClick={() => onSelect("")}
                  type="button"
                >
                  <FolderOpen size={16} />
                  <span>Raiz</span>
                  <small>{procedureCounts[""] || 0}</small>
                </button>
              </div>

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
                  onDragCollection={onDragCollection}
                  onDragEnd={() => {
                    setDropTargetId(null);
                    onDragEnd();
                  }}
                  onDragItem={onDragItem}
                  onDragOverCollection={setDropTargetId}
                  onDelete={onCreate ? onDelete : undefined}
                  onDrop={dropAt}
                  onRename={onRename}
                  onSelect={onSelect}
                  onSelectItem={onSelectItem}
                  onToggle={(collectionId) =>
                    setCollapsedIds((current) => {
                      const next = new Set(current);
                      if (next.has(collectionId)) next.delete(collectionId);
                      else next.add(collectionId);
                      return next;
                    })
                  }
                  procedureCounts={procedureCounts}
                  renderItem={renderItem}
                  selectedCollectionId={selectedCollectionId}
                  visited={new Set()}
                />
              ))}
              {(itemsByCollection.get("") || []).map((item) => (
                <CollectionItemNode
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
              onChange={(name) =>
                updateCollectionDraft(selectedCollectionId, name)
              }
              onSubmit={(event) => createAt(event, selectedCollectionId)}
            />
          ) : null}
        </div>
      ) : (
        <div
          className="procedureCollectionColumns"
          ref={columnsRef}
          role="tree"
        >
          {columnNavigation.columns.map((column, columnIndex) => (
            <div
              className="procedureCollectionColumn"
              key={`${column.parentId || "root"}-${columnIndex}`}
              role="group"
            >
              <div className="procedureCollectionColumnList">
                {columnIndex === 0 ? (
                  <div
                    aria-selected={!selectedCollectionId}
                    className={[
                      "procedureCollectionColumnRow",
                      "procedureCollectionColumnRootRow",
                      !selectedCollectionId
                        ? "selectedProcedureCollection"
                        : "",
                      dropTargetId === ""
                        ? "procedureCollectionDropTarget"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onDragOver={(event) => {
                      if (!draggedItem) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetId("");
                    }}
                    onDrop={(event) => {
                      if (!draggedItem) return;
                      event.preventDefault();
                      dropAt("");
                    }}
                    role="treeitem"
                  >
                    <button
                      className="procedureCollectionColumnSelectButton"
                      onClick={() => onSelect("")}
                      type="button"
                    >
                      <FolderOpen size={16} />
                      <span>Raiz</span>
                      <small>{procedureCounts[""] || 0}</small>
                    </button>
                  </div>
                ) : null}

                {column.collections.map((collection) => (
                  <CollectionColumnRow
                    active={
                      columnNavigation.activePath[columnIndex] === collection.id
                    }
                    childrenByParent={childrenByParent}
                    collection={collection}
                    draggedItem={draggedItem}
                    dropTargetId={dropTargetId}
                    key={collection.id}
                    onDelete={onCreate ? onDelete : undefined}
                    onDragCollection={onDragCollection}
                    onDragEnd={() => {
                      setDropTargetId(null);
                      onDragEnd();
                    }}
                    onDragOverCollection={setDropTargetId}
                    onDrop={dropAt}
                    onRename={
                      selectedCollectionId === collection.id
                        ? onRename
                        : undefined
                    }
                    onSelect={onSelect}
                    procedureCounts={procedureCounts}
                  />
                ))}

                {(itemsByCollection.get(column.parentId) || []).map((item) => (
                  <CollectionItemNode
                    canDrag={Boolean(onDragItem) && canDragItem(item)}
                    getItemId={getItemId}
                    item={item}
                    key={getItemId(item)}
                    onDragEnd={onDragEnd}
                    onDragItem={onDragItem}
                    onSelectItem={onSelectItem}
                    renderItem={renderItem}
                    viewMode="columns"
                  />
                ))}

                {!column.collections.length &&
                !(itemsByCollection.get(column.parentId) || []).length &&
                columnIndex > 0 ? (
                  <p className="procedureCollectionColumnEmpty">
                    Nenhuma subcoleção
                  </p>
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
                  onChange={(name) =>
                    updateCollectionDraft(column.parentId, name)
                  }
                  onSubmit={(event) => createAt(event, column.parentId)}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function ResourceCollectionDialog({
  collection,
  parentLabel,
  onClose,
  onSave,
  resourceLabel = "procedimentos",
}) {
  const editing = Boolean(collection);
  const [name, setName] = useState(collection?.name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(name);
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-labelledby="procedureCollectionDialogTitle"
        aria-modal="true"
        className="procedureCollectionDialog"
        role="dialog"
      >
        <header className="procedureCollectionDialogHeader">
          <div>
            <span>Organização de {resourceLabel}</span>
            <h2 id="procedureCollectionDialogTitle">
              {editing ? "Renomear coleção" : "Nova coleção"}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <form className="procedureCollectionDialogForm" onSubmit={submit}>
          {error ? <div className="errorBox">{error}</div> : null}
          {editing ? (
            <p>Altere o nome usado para identificar esta coleção.</p>
          ) : (
            <p>
              A coleção será criada em <strong>{parentLabel}</strong>.
            </p>
          )}
          <label className="field">
            <span>Nome da coleção</span>
            <input
              autoFocus
              disabled={saving}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Banco de dados"
              required
              value={name}
            />
          </label>
          <footer className="procedureCollectionDialogFooter">
            <button
              className="secondaryButton"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={saving || !name.trim()}
              type="submit"
            >
              {editing ? <Pencil size={16} /> : <FolderPlus size={16} />}
              {saving
                ? editing
                  ? "Salvando..."
                  : "Criando..."
                : editing
                  ? "Salvar nome"
                  : "Criar coleção"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
