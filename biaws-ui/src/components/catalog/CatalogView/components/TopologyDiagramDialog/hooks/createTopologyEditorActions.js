import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";

import {
  automaticTopologyHandles,
  resizeTopologyGroups,
  topologyConnectionLabel,
} from "../models/topologyDiagramModel.js";
import { edgeDirectionMarkers } from "../models/topologyDiagramPresentation.js";

export function createTopologyEditorActions({
  canEdit,
  nodes,
  selectedEdgeId,
  selectedElement,
  selectedElementId,
  selectedGroup,
  selectedGroupId,
  setDirty,
  setEdges,
  setNodes,
  setSelectedEdgeId,
  setSelectedElementId,
  setSelectedGroupId,
}) {
  function changeNodes(changes) {
    const allowedChanges = changes.filter(
      ({ type }) => type !== "remove" && (canEdit || type !== "position"),
    );
    setNodes((current) => applyNodeChanges(allowedChanges, current));
    if (allowedChanges.some(({ type }) => type === "position")) setDirty(true);
  }

  function changeEdges(changes) {
    const allowedChanges = canEdit
      ? changes
      : changes.filter(({ type }) => type === "select");
    setEdges((current) => applyEdgeChanges(allowedChanges, current));
    if (allowedChanges.some(({ type }) => type !== "select")) setDirty(true);
  }

  function connect(connection) {
    if (!canEdit || connection.source === connection.target) return;
    const id = `edge-${crypto.randomUUID()}`;
    const connectionType = "dependency";
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          ...automaticTopologyHandles(
            nodes,
            connection.source,
            connection.target,
          ),
          id,
          type: "default",
          ...edgeDirectionMarkers("forward"),
          label: topologyConnectionLabel(connectionType),
          data: { connectionType, direction: "forward", customLabel: "" },
        },
        current,
      ),
    );
    setSelectedEdgeId(id);
    setSelectedElementId("");
    setSelectedGroupId("");
    setDirty(true);
  }

  function createGroup() {
    if (!canEdit) return;
    const id = `group:${crypto.randomUUID()}`;
    const groupCount = nodes.filter(
      ({ type }) => type === "topologyGroup",
    ).length;
    setNodes((current) => [
      {
        id,
        type: "topologyGroup",
        deletable: false,
        position: { x: 80 + groupCount * 36, y: 80 + groupCount * 36 },
        style: { width: 640, height: 380 },
        data: {
          group: {
            id,
            title: `Grupo ${groupCount + 1}`,
            description: "",
          },
        },
      },
      ...current,
    ]);
    setSelectedEdgeId("");
    setSelectedElementId("");
    setSelectedGroupId(id);
    setDirty(true);
  }

  function createElement() {
    if (!canEdit) return;
    const id = `element:${crypto.randomUUID()}`;
    const elementCount = nodes.filter(
      ({ type }) => type === "topologyElement",
    ).length;
    setNodes((current) => [
      ...current,
      {
        id,
        type: "topologyElement",
        deletable: false,
        position: { x: 120 + elementCount * 36, y: 120 + elementCount * 36 },
        data: {
          element: {
            id,
            type: "Elemento",
            title: `Elemento ${elementCount + 1}`,
            description: "",
            headerColor: "#edf9f5",
          },
        },
      },
    ]);
    setSelectedEdgeId("");
    setSelectedGroupId("");
    setSelectedElementId(id);
    setDirty(true);
  }

  function updateSelectedGroup(field, value) {
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedGroupId
          ? {
              ...node,
              data: {
                ...node.data,
                group: { ...node.data.group, [field]: value },
              },
            }
          : node,
      ),
    );
    setDirty(true);
  }

  function updateSelectedElement(field, value) {
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedElementId
          ? {
              ...node,
              data: {
                ...node.data,
                element: { ...node.data.element, [field]: value },
              },
            }
          : node,
      ),
    );
    setDirty(true);
  }

  function toggleNodeInSelectedGroup(nodeId, included) {
    if (!selectedGroup) return;
    setNodes((current) => {
      const group = current.find(({ id }) => id === selectedGroup.id);
      if (!group) return current;
      const childCount = current.filter(
        ({ parentId }) => parentId === group.id,
      ).length;
      const targetPosition = {
        x: 24 + (childCount % 2) * 300,
        y: 92 + Math.floor(childCount / 2) * 210,
      };
      const updated = current.map((node) => {
        if (node.id !== nodeId) return node;
        if (!included) {
          return {
            ...node,
            position: {
              x: group.position.x + node.position.x,
              y: group.position.y + node.position.y,
            },
            parentId: undefined,
            extent: undefined,
            expandParent: undefined,
          };
        }
        return {
          ...node,
          parentId: group.id,
          extent: "parent",
          expandParent: true,
          position: targetPosition,
        };
      });
      return resizeTopologyGroups(updated);
    });
    setDirty(true);
  }

  function removeSelectedGroup() {
    if (!selectedGroup || !canEdit) return;
    const group = selectedGroup;
    setNodes((current) =>
      resizeTopologyGroups(
        current
          .filter(({ id }) => id !== group.id)
          .map((node) =>
            node.parentId === group.id
              ? {
                  ...node,
                  position: {
                    x: group.position.x + node.position.x,
                    y: group.position.y + node.position.y,
                  },
                  parentId: undefined,
                  extent: undefined,
                  expandParent: undefined,
                }
              : node,
          ),
      ),
    );
    setEdges((current) =>
      current.filter(
        ({ source, target }) => source !== group.id && target !== group.id,
      ),
    );
    setSelectedGroupId("");
    setDirty(true);
  }

  function removeSelectedElement() {
    if (!selectedElement || !canEdit) return;
    setNodes((current) =>
      resizeTopologyGroups(
        current.filter(({ id }) => id !== selectedElement.id),
      ),
    );
    setEdges((current) =>
      current.filter(
        ({ source, target }) =>
          source !== selectedElement.id && target !== selectedElement.id,
      ),
    );
    setSelectedElementId("");
    setDirty(true);
  }

  function updateSelectedEdge(field, value) {
    setEdges((current) =>
      current.map((edge) => {
        if (edge.id !== selectedEdgeId) return edge;
        const data =
          field === "lineType" ? edge.data : { ...edge.data, [field]: value };
        return {
          ...edge,
          ...(field === "lineType" ? { type: value } : {}),
          data,
          ...edgeDirectionMarkers(data.direction),
          label: topologyConnectionLabel(data.connectionType, data.customLabel),
        };
      }),
    );
    setDirty(true);
  }

  function removeSelectedEdge() {
    setEdges((current) => current.filter(({ id }) => id !== selectedEdgeId));
    setSelectedEdgeId("");
    setDirty(true);
  }

  return {
    changeEdges,
    changeNodes,
    connect,
    createElement,
    createGroup,
    removeSelectedEdge,
    removeSelectedElement,
    removeSelectedGroup,
    toggleNodeInSelectedGroup,
    updateSelectedEdge,
    updateSelectedElement,
    updateSelectedGroup,
  };
}
