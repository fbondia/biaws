import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

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

function CollectionTreeNode({
  collection,
  childrenByParent,
  collapsedIds,
  draggedItem,
  dropTargetId,
  onDragCollection,
  onDragEnd,
  onDragOverCollection,
  onDelete,
  onDrop,
  onSelect,
  onToggle,
  procedureCounts,
  selectedCollectionId,
  visited,
}) {
  if (visited.has(collection.id)) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(collection.id);
  const children = childrenByParent.get(collection.id) || [];
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
        draggable
        onDragEnd={onDragEnd}
        onDragStart={(event) => {
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
          disabled={!children.length}
          onClick={() => onToggle(collection.id)}
          type="button"
        >
          {children.length ? (
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
          {expanded && children.length ? (
            <FolderOpen size={16} />
          ) : (
            <Folder size={16} />
          )}
          <span>{collection.name}</span>
          <small>{procedureCounts[collection.id] || 0}</small>
        </button>
        <button
          aria-label={`Excluir coleção ${collection.name}`}
          className="procedureCollectionDeleteButton"
          onClick={() => onDelete(collection)}
          title="Excluir coleção vazia"
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && children.length ? (
        <div className="procedureCollectionTreeChildren">
          {children.map((child) => (
            <CollectionTreeNode
              childrenByParent={childrenByParent}
              collapsedIds={collapsedIds}
              collection={child}
              draggedItem={draggedItem}
              dropTargetId={dropTargetId}
              key={child.id}
              onDragCollection={onDragCollection}
              onDragEnd={onDragEnd}
              onDragOverCollection={onDragOverCollection}
              onDelete={onDelete}
              onDrop={onDrop}
              onSelect={onSelect}
              onToggle={onToggle}
              procedureCounts={procedureCounts}
              selectedCollectionId={selectedCollectionId}
              visited={nextVisited}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProcedureCollectionSidebar({
  collections,
  draggedItem,
  items,
  onDragCollection,
  onDragEnd,
  onDelete,
  onDrop,
  onSelect,
  selectedCollectionId,
}) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [dropTargetId, setDropTargetId] = useState(null);
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

  function dropAt(collectionId) {
    setDropTargetId(null);
    onDrop(collectionId);
  }

  return (
    <aside className="procedureCollectionsPanel">
      <header>
        <div>
          <strong>Coleções</strong>
          <span>Arraste procedimentos e coleções para organizar.</span>
        </div>
      </header>

      <div className="procedureCollectionTree">
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
            childrenByParent={childrenByParent}
            collapsedIds={collapsedIds}
            collection={collection}
            draggedItem={draggedItem}
            dropTargetId={dropTargetId}
            key={collection.id}
            onDragCollection={onDragCollection}
            onDragEnd={() => {
              setDropTargetId(null);
              onDragEnd();
            }}
            onDragOverCollection={setDropTargetId}
            onDelete={onDelete}
            onDrop={dropAt}
            onSelect={onSelect}
            onToggle={(collectionId) =>
              setCollapsedIds((current) => {
                const next = new Set(current);
                if (next.has(collectionId)) next.delete(collectionId);
                else next.add(collectionId);
                return next;
              })
            }
            procedureCounts={procedureCounts}
            selectedCollectionId={selectedCollectionId}
            visited={new Set()}
          />
        ))}
      </div>
    </aside>
  );
}

export function ProcedureCollectionDialog({
  collection,
  parentLabel,
  onClose,
  onSave,
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
            <span>Organização de procedimentos</span>
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
