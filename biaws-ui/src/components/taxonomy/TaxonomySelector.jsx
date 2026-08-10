import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CAN_MODIFY_CATALOG = true;

function toggleApplicationId(current, applicationId, checked) {
  if (!checked) return [...current, applicationId];
  return current.filter((id) => id !== applicationId);
}

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
  applications = [],
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
  const [editScopeMode, setEditScopeMode] = useState("workspace");
  const [editApplicationIds, setEditApplicationIds] = useState([]);
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
    const applicationIds = Array.isArray(node.applicationIds)
      ? node.applicationIds
      : [];
    setEditApplicationIds(applicationIds);
    setEditScopeMode(applicationIds.length ? "applications" : "workspace");
  }

  function closeEditDialog() {
    setEditingNode(null);
    setEditLabel("");
    setEditApplicationIds([]);
    setEditScopeMode("workspace");
  }

  async function editNode(event) {
    event.preventDefault();
    if (!editingNode || !onEditNode) return;

    const trimmedLabel = editLabel.trim();
    if (!trimmedLabel) return;

    const applicationIds =
      editScopeMode === "workspace" ? [] : editApplicationIds;
    if (
      trimmedLabel === editingNode.label &&
      JSON.stringify(applicationIds) ===
        JSON.stringify(editingNode.applicationIds || [])
    ) {
      closeEditDialog();
      return;
    }

    const updatedNode = await onEditNode(editingNode.id, {
      label: trimmedLabel,
      applicationIds,
    });
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
            className="taxonomyEditDialog taxonomyNodeEditDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Editar assunto</strong>
                <span>
                  Altere o título e onde este item pode ser utilizado.
                </span>
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
              <fieldset className="taxonomyApplicationScope">
                <legend>Aplicável a</legend>
                <label className="taxonomyScopeOption">
                  <input
                    checked={editScopeMode === "workspace"}
                    name="taxonomy-scope"
                    onChange={() => setEditScopeMode("workspace")}
                    type="radio"
                  />
                  <span>
                    <strong>Todas as aplicações</strong>
                    <small>
                      O item fica disponível em todo o workspace, respeitando o
                      escopo do item superior.
                    </small>
                  </span>
                </label>
                <label className="taxonomyScopeOption">
                  <input
                    checked={editScopeMode === "applications"}
                    name="taxonomy-scope"
                    onChange={() => setEditScopeMode("applications")}
                    type="radio"
                  />
                  <span>
                    <strong>Aplicações específicas</strong>
                    <small>Selecione uma ou mais aplicações abaixo.</small>
                  </span>
                </label>
                {editScopeMode === "applications" ? (
                  <div className="taxonomyApplicationList">
                    {applications.length ? (
                      applications.map((application) => {
                        const checked = editApplicationIds.includes(
                          application.id,
                        );
                        return (
                          <label key={application.id}>
                            <input
                              checked={checked}
                              onChange={() =>
                                setEditApplicationIds((current) =>
                                  toggleApplicationId(
                                    current,
                                    application.id,
                                    checked,
                                  ),
                                )
                              }
                              type="checkbox"
                            />
                            <span>{application.name || application.id}</span>
                            {application.status !== "active" ? (
                              <small>Arquivada</small>
                            ) : null}
                          </label>
                        );
                      })
                    ) : (
                      <span className="fieldHint">
                        Nenhuma aplicação cadastrada no workspace.
                      </span>
                    )}
                  </div>
                ) : null}
              </fieldset>
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
                  disabled={
                    !editLabel.trim() ||
                    (editScopeMode === "applications" &&
                      !editApplicationIds.length)
                  }
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
