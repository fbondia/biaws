import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CornerDownRight,
  CornerUpLeft,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Fragment, useLayoutEffect, useRef, useState } from "react";

import {
  MAX_CATALOG_DEPTH,
  catalogChildren,
  catalogDescendants,
  moveCatalogItem,
  removeCatalogItem,
} from "../../../../../../../shared/catalogTree.js";
import { MarkdownEditor, MarkdownPreview } from "../../../../shared/MarkdownEditor/index.jsx";

export function CatalogItems({ items = [], attachments, onLoadAttachment, parentId = "", depth = 0 }) {
  const children = catalogChildren(items, parentId);
  if (!children.length) return parentId ? null : <p className="muted">Nenhum elemento no catálogo.</p>;
  return (
    <div className="knowledgeCatalogItems">
      {children.map((item) => (
        <details
          className={`knowledgeCatalogItem${depth % 2 ? " knowledgeCatalogItemAlternateSurface" : ""}`}
          key={item.id}
        >
          <summary>{item.title}</summary>
          <div className="knowledgeCatalogItemBody">
            {!item.hideDescription && item.description?.trim() ? (
              <MarkdownPreview attachments={attachments} onLoadAttachment={onLoadAttachment} value={item.description} />
            ) : null}
            <CatalogItems
              items={items}
              parentId={item.id}
              depth={depth + 1}
              attachments={attachments}
              onLoadAttachment={onLoadAttachment}
            />
          </div>
        </details>
      ))}
    </div>
  );
}

export function CatalogEditor({ draft, onChange, onLoadAttachment }) {
  const items = draft.details.items || [];
  const [dragId, setDragId] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const editorRef = useRef(null);
  const pendingFocusId = useRef("");

  useLayoutEffect(() => {
    if (!pendingFocusId.current) return;
    const input = [...(editorRef.current?.querySelectorAll("[data-catalog-item-title]") || [])].find(
      (element) => element.dataset.catalogItemTitle === pendingFocusId.current,
    );
    if (!input) return;
    // Reveal the new item and its ancestors before moving focus into it.
    for (let details = input.closest("details"); details; details = details.parentElement?.closest("details")) {
      details.open = true;
    }
    pendingFocusId.current = "";
    input.focus();
    input.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [items]);
  function changeItems(nextItems) {
    onChange({ ...draft, details: { ...draft.details, items: nextItems } });
  }
  function updateItem(id, changes) {
    changeItems(items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }
  function addItem(parentId = "") {
    if (items.length >= 500) return;
    const id = crypto.randomUUID();
    pendingFocusId.current = id;
    changeItems([{ id, title: "", description: "", ...(parentId ? { parentId } : {}) }, ...items]);
  }
  function move(id, parentId = "", beforeId = "") {
    changeItems(moveCatalogItem(items, id, parentId, beforeId));
  }
  function canDrop(parentId, beforeId = "") {
    return dragId && moveCatalogItem(items, dragId, parentId, beforeId) !== items;
  }
  function dropHandlers(parentId, beforeId = "", key = `before:${parentId}:${beforeId}`) {
    const enabled = canDrop(parentId, beforeId);
    return {
      onDragOver(event) {
        if (!enabled) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setDropTarget(key);
      },
      onDrop(event) {
        event.stopPropagation();
        if (!enabled) return;
        event.preventDefault();
        move(dragId, parentId, beforeId);
        setDragId("");
        setDropTarget("");
      },
    };
  }
  function dropZone(parentId, beforeId = "") {
    const key = `before:${parentId}:${beforeId}`;
    return (
      <div
        aria-label={
          beforeId
            ? `Mover antes de ${items.find(({ id }) => id === beforeId)?.title || "elemento"}`
            : parentId
              ? "Mover para o fim dos subitens"
              : "Mover para a raiz do catálogo"
        }
        className={`knowledgeCatalogDropZone ${dropTarget === key ? "knowledgeCatalogDropActive" : ""}`}
        {...dropHandlers(parentId, beforeId, key)}
      >
        {dragId ? <span>{parentId ? "Soltar neste nível" : "Soltar na raiz"}</span> : null}
      </div>
    );
  }
  function renderItems(parentId = "", depth = 0) {
    const siblings = catalogChildren(items, parentId);
    return (
      <div className="knowledgeCatalogItems">
        {siblings.map((item, position) => {
          const number = items.indexOf(item) + 1;
          const parent = items.find(({ id }) => id === parentId);
          const parentSiblings = parent ? catalogChildren(items, parent.parentId || "") : [];
          const afterParent = parent ? parentSiblings[parentSiblings.indexOf(parent) + 1]?.id || "" : "";
          const subtreeSize = catalogDescendants(items, item.id).size;
          const canIndent = position > 0 && moveCatalogItem(items, item.id, siblings[position - 1].id) !== items;
          return (
            <Fragment key={item.id}>
              {dropZone(parentId, item.id)}
              <details
                className={`knowledgeCatalogItem ${depth % 2 ? "knowledgeCatalogItemAlternateSurface" : ""} ${dragId === item.id ? "knowledgeCatalogDragging" : ""} ${dropTarget === `inside:${item.id}` ? "knowledgeCatalogDropActive" : ""}`}
              >
                <summary className="knowledgeCatalogSummary" {...dropHandlers(item.id, "", `inside:${item.id}`)}>
                  <ChevronRight className="knowledgeCatalogChevron" size={16} aria-hidden="true" />
                  <span className="knowledgeCatalogItemTitle">{item.title || `Novo elemento ${number}`}</span>
                  {dragId && canDrop(item.id) ? <small>Soltar dentro</small> : null}
                  <span
                    className="knowledgeCatalogItemActions knowledgeCatalogSummaryActions"
                    role="group"
                    aria-label={`Organizar elemento ${number}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <button
                      aria-label={`Mover elemento ${number} acima`}
                      className="iconButton"
                      disabled={position === 0}
                      onClick={() => move(item.id, parentId, siblings[position - 1].id)}
                      type="button"
                      title="Mover acima"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      aria-label={`Mover elemento ${number} abaixo`}
                      className="iconButton"
                      disabled={position === siblings.length - 1}
                      onClick={() => move(item.id, parentId, siblings[position + 2]?.id || "")}
                      type="button"
                      title="Mover abaixo"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      aria-label={`Aninhar elemento ${number}`}
                      className="iconButton"
                      disabled={!canIndent}
                      onClick={() => move(item.id, siblings[position - 1].id)}
                      type="button"
                      title="Colocar dentro do item anterior"
                    >
                      <CornerDownRight size={16} />
                    </button>
                    <button
                      aria-label={`Mover elemento ${number} para o nível acima`}
                      className="iconButton"
                      disabled={!parent}
                      onClick={() => move(item.id, parent.parentId || "", afterParent)}
                      type="button"
                      title="Mover para o nível acima"
                    >
                      <CornerUpLeft size={16} />
                    </button>
                    <button
                      aria-label={`Arrastar elemento ${number}`}
                      className="iconButton knowledgeCatalogDragHandle"
                      draggable
                      type="button"
                      title="Arraste para ordenar, soltar dentro de outro item ou mover para a raiz"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onDragStart={(event) => {
                        event.stopPropagation();
                        event.dataTransfer.setData("text/plain", item.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDragId(item.id);
                      }}
                      onDragEnd={() => {
                        setDragId("");
                        setDropTarget("");
                      }}
                    >
                      <GripVertical size={16} aria-hidden="true" />
                    </button>
                  </span>
                </summary>
                <div className="knowledgeCatalogItemBody">
                  <div className="knowledgeCatalogTitleEditor">
                    <label className="field">
                      <span>Título / nome</span>
                      <input
                        aria-label={`Título do elemento ${number}`}
                        data-catalog-item-title={item.id}
                        maxLength={240}
                        onChange={(event) => updateItem(item.id, { title: event.target.value })}
                        required
                        value={item.title}
                      />
                    </label>
                    <button
                      aria-label={`${item.hideDescription ? "Exibir" : "Ocultar"} descrição do elemento ${number}`}
                      aria-pressed={Boolean(item.hideDescription)}
                      className="iconButton knowledgeCatalogDescriptionToggle"
                      title={item.hideDescription ? "Exibir descrição" : "Ocultar descrição"}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        updateItem(item.id, { hideDescription: !item.hideDescription });
                      }}
                      type="button"
                    >
                      {item.hideDescription ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      aria-label="Adicionar subitem"
                      className="iconButton"
                      title="Adicionar subitem"
                      disabled={items.length >= 500 || !canDropDepth(item.id)}
                      onClick={() => addItem(item.id)}
                      type="button"
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                    <button
                      aria-label={`Remover elemento ${number}`}
                      className="iconButton dangerIconButton"
                      title={subtreeSize > 1 ? `Remover elemento e ${subtreeSize - 1} subitens` : "Remover elemento"}
                      onClick={() => changeItems(removeCatalogItem(items, item.id))}
                      type="button"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                  {!item.hideDescription ? (
                    <div className="field">
                      <span>Descrição em Markdown (opcional)</span>
                      <MarkdownEditor
                        ariaLabel={`Descrição do elemento ${number}`}
                        attachments={draft.attachments}
                        initialMode="text"
                        onChange={(description) => updateItem(item.id, { description })}
                        onLoadAttachment={onLoadAttachment}
                        value={item.description || ""}
                      />
                    </div>
                  ) : null}
                  {renderItems(item.id, depth + 1)}
                </div>
              </details>
            </Fragment>
          );
        })}
        {dropZone(parentId)}
      </div>
    );
  }
  function canDropDepth(parentId) {
    let depth = 1;
    while (parentId && depth <= MAX_CATALOG_DEPTH) {
      depth += 1;
      parentId = items.find(({ id }) => id === parentId)?.parentId || "";
    }
    return depth <= MAX_CATALOG_DEPTH;
  }
  return (
    <section className="knowledgeCatalogEditor" aria-label="Elementos do catálogo" ref={editorRef}>
      <div className="knowledgeCatalogToolbar">
        <h3>Elementos do catálogo ({items.length})</h3>
        <button className="secondaryButton" disabled={items.length >= 500} onClick={() => addItem()} type="button">
          <Plus size={16} /> Adicionar elemento
        </button>
      </div>
      <p className="muted">
        Arraste pela alça para ordenar. Solte sobre um título para aninhar ou nas faixas para mudar de nível. Salve o
        documento para aplicar.
      </p>
      {!items.length ? <p className="muted">Adicione o primeiro elemento do catálogo.</p> : null}
      {renderItems()}
    </section>
  );
}
