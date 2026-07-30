import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CAN_MODIFY_CATALOG = true;

function findNodePath(nodes = [], targetId, currentPath = []) {
  for (const node of nodes) {
    const nextPath = [...currentPath, node.id];
    if (node.id === targetId) return nextPath;

    const childPath = findNodePath(node.children || [], targetId, nextPath);
    if (childPath.length) return childPath;
  }

  return [];
}

function findNodeById(nodes = [], targetId) {
  for (const node of nodes) {
    if (node.id === targetId) return node;

    const child = findNodeById(node.children || [], targetId);
    if (child) return child;
  }

  return null;
}

function buildColumns(nodes, activePath, canAddNodes) {
  const columns = [{ parentId: "root", nodes }];
  let currentNodes = nodes;

  for (const nodeId of activePath) {
    const currentNode = currentNodes.find((node) => node.id === nodeId);
    if (!currentNode) break;

    if (!currentNode.children?.length) {
      if (canAddNodes) {
        columns.push({ parentId: currentNode.id, nodes: [] });
      }
      break;
    }

    currentNodes = currentNode.children;
    columns.push({ parentId: currentNode.id, nodes: currentNodes });
  }

  return columns;
}

function normalizeSelectedValues(value, multiple) {
  if (multiple) return Array.isArray(value) ? value : [];
  return value ? [value] : [];
}

export function TaxonomySelector({
  activeValue = "",
  disabledIds = [],
  multiple = false,
  nodes = [],
  onActiveChange,
  onAddNode,
  onChange,
  onDeleteNode,
  onEditNode,
  onPrimaryChange,
  primaryValue = "",
  selectable = true,
  value,
}) {
  const disabledSet = useMemo(() => new Set(disabledIds), [disabledIds]);
  const selectedValues = normalizeSelectedValues(value, multiple);
  const firstSelectedValue = selectedValues[0] || "";
  const controlledActiveValue = selectable ? firstSelectedValue : activeValue;
  const [activePath, setActivePath] = useState(() =>
    findNodePath(nodes, controlledActiveValue),
  );
  const [draftLabels, setDraftLabels] = useState({});
  const [editingNode, setEditingNode] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const canAddNodes = CAN_MODIFY_CATALOG && Boolean(onAddNode);
  const canDeleteNodes = CAN_MODIFY_CATALOG && Boolean(onDeleteNode);
  const canEditNodes = CAN_MODIFY_CATALOG && Boolean(onEditNode);
  const deepestActiveNodeId = activePath[activePath.length - 1] || "";
  const columns = useMemo(
    () => buildColumns(nodes, activePath, canAddNodes),
    [activePath, canAddNodes, nodes],
  );

  useEffect(() => {
    setActivePath(findNodePath(nodes, controlledActiveValue));
  }, [controlledActiveValue, nodes]);

  function navigateToNode(nodeId) {
    const nextPath = findNodePath(nodes, nodeId);
    setActivePath(nextPath);
    onActiveChange?.(nodeId);
  }

  function toggleSelection(nodeId) {
    if (disabledSet.has(nodeId)) return;

    if (!multiple) {
      onChange(value === nodeId ? "" : nodeId);
      return;
    }

    const nextValues = selectedValues.includes(nodeId)
      ? selectedValues.filter((selectedValue) => selectedValue !== nodeId)
      : [...selectedValues, nodeId];

    onChange(nextValues);
  }

  function selectPrimary(event, nodeId) {
    event.stopPropagation();
    if (!selectedValues.includes(nodeId) || !onPrimaryChange) return;
    onPrimaryChange(nodeId);
  }

  function openEditDialog(event, node) {
    event.stopPropagation();
    setEditingNode(node);
    setEditLabel(node.label || "");
  }

  function closeEditDialog() {
    setEditingNode(null);
    setEditLabel("");
  }

  async function editNode(event) {
    event.preventDefault();
    if (!editingNode || !onEditNode) return;

    const trimmedLabel = editLabel.trim();
    if (!trimmedLabel) return;

    if (trimmedLabel === editingNode.label) {
      closeEditDialog();
      return;
    }

    const updatedNode = await onEditNode(editingNode.id, trimmedLabel);
    if (updatedNode) closeEditDialog();
  }

  async function deleteNode() {
    if (!editingNode || !onDeleteNode) return;

    const deleted = await onDeleteNode(editingNode.id);
    if (deleted !== false) closeEditDialog();
  }

  async function addNode(event, parentId) {
    event.preventDefault();

    const columnKey = parentId || "root";
    const label = (draftLabels[columnKey] || "").trim();
    if (!label || !onAddNode) return;

    const newNode = await onAddNode(parentId, label);
    if (newNode?.id) {
      setDraftLabels((current) => ({ ...current, [columnKey]: "" }));
      setActivePath(findNodePath(nodes, parentId).concat(newNode.id));
    }
  }

  if (!nodes.length && !canAddNodes) {
    return <></>;
  }

  return (
    <div className="taxonomySelector">
      <div className="taxonomyColumns" role="tree">
        {columns.map((column, columnIndex) => (
          <div
            className="taxonomyColumn"
            key={`${column.parentId}-${columnIndex}`}
            role="group"
          >
            <div className="taxonomyColumnList">
              {!column.nodes.length ? <></> : null}
              {column.nodes.map((node) => {
                const checked = selectedValues.includes(node.id);
                const disabled = disabledSet.has(node.id);
                const active = activePath[columnIndex] === node.id;
                const hasChildren = Boolean(node.children?.length);
                const canEditThisNode =
                  canEditNodes && active && deepestActiveNodeId === node.id;
                const nodePath = findNodePath(nodes, node.id);
                const pathLabel = nodePath
                  .map((pathNodeId) => findNodeById(nodes, pathNodeId)?.label)
                  .filter(Boolean)
                  .join(" / ");

                return (
                  <div
                    aria-disabled={disabled}
                    aria-selected={active}
                    className={[
                      "taxonomyColumnRow",
                      active ? "activeTaxonomyColumnRow" : "",
                      checked ? "checkedTaxonomyColumnRow" : "",
                      disabled ? "disabledTaxonomyColumnRow" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={node.id}
                    onClick={() => navigateToNode(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateToNode(node.id);
                      }
                    }}
                    role="treeitem"
                    tabIndex={0}
                    title={pathLabel}
                  >
                    {selectable ? (
                      <input
                        aria-label={`Selecionar ${node.label}`}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleSelection(node.id)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                    ) : null}
                    <span>{node.label}</span>
                    {multiple && checked && onPrimaryChange ? (
                      <button
                        className={
                          primaryValue === node.id
                            ? "taxonomyPrimaryBadge activeTaxonomyPrimaryBadge"
                            : "taxonomyPrimaryBadge"
                        }
                        onClick={(event) => selectPrimary(event, node.id)}
                        onKeyDown={(event) => event.stopPropagation()}
                        title={
                          primaryValue === node.id
                            ? "Assunto principal"
                            : "Definir como assunto principal"
                        }
                        type="button"
                      >
                        {primaryValue === node.id
                          ? "Principal"
                          : "Definir principal"}
                      </button>
                    ) : null}
                    {canEditThisNode ? (
                      <button
                        className="taxonomyColumnEditButton"
                        onClick={(event) => openEditDialog(event, node)}
                        onKeyDown={(event) => event.stopPropagation()}
                        title="Editar título do assunto"
                        type="button"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                    ) : null}
                    {hasChildren ? <ChevronRight size={15} /> : null}
                  </div>
                );
              })}
            </div>
            {canAddNodes ? (
              <form
                className="taxonomyColumnAdd"
                onSubmit={(event) =>
                  addNode(
                    event,
                    column.parentId === "root" ? null : column.parentId,
                  )
                }
              >
                <input
                  onChange={(event) =>
                    setDraftLabels((current) => ({
                      ...current,
                      [column.parentId]: event.target.value,
                    }))
                  }
                  placeholder="Novo nó"
                  value={draftLabels[column.parentId] || ""}
                />
                <button
                  aria-label="Adicionar nó"
                  disabled={!draftLabels[column.parentId]?.trim()}
                  type="submit"
                >
                  <Plus size={14} />
                </button>
              </form>
            ) : null}
          </div>
        ))}
      </div>

      {editingNode ? (
        <div
          className="taxonomyEditBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditDialog();
          }}
        >
          <section
            aria-label="Editar assunto"
            aria-modal="true"
            className="taxonomyEditDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Editar assunto</strong>
                <span>Altere apenas o título do item selecionado.</span>
              </div>
            </header>
            <form onSubmit={editNode}>
              <label className="field">
                <span>Título</span>
                <input
                  autoFocus
                  onChange={(event) => setEditLabel(event.target.value)}
                  value={editLabel}
                />
              </label>
              <div className="dialogActions">
                {canDeleteNodes ? (
                  <button
                    className="dangerButton taxonomyDeleteNodeButton"
                    onClick={deleteNode}
                    type="button"
                  >
                    <Trash2 size={15} />
                    Excluir nó
                  </button>
                ) : null}
                <button
                  className="secondaryButton"
                  data-dialog-close
                  onClick={closeEditDialog}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="primaryButton"
                  disabled={!editLabel.trim()}
                  type="submit"
                >
                  Salvar
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
