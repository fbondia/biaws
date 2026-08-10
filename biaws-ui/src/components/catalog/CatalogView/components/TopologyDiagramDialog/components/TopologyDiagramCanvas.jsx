import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
} from "@xyflow/react";

import { TopologyElementNode } from "../../TopologyElementNode.jsx";
import { TopologyGroupNode } from "../../TopologyGroupNode.jsx";
import { TopologyIntegrationNode } from "../../TopologyIntegrationNode.jsx";
import { TopologyServerNode } from "../../TopologyServerNode.jsx";
import { CommentsPanel } from "./CommentsPanel.jsx";
import { EdgeEditorPanel } from "./EdgeEditorPanel.jsx";
import { ElementEditorPanel } from "./ElementEditorPanel.jsx";
import { GroupEditorPanel } from "./GroupEditorPanel.jsx";

const nodeTypes = {
  topologyElement: TopologyElementNode,
  topologyGroup: TopologyGroupNode,
  topologyIntegration: TopologyIntegrationNode,
  topologyServer: TopologyServerNode,
};

function SelectedEditor({
  controller,
  selectedEdge,
  selectedElement,
  selectedGroup,
}) {
  if (selectedGroup) return <GroupEditorPanel controller={controller} />;
  if (selectedElement) return <ElementEditorPanel controller={controller} />;
  if (selectedEdge) return <EdgeEditorPanel controller={controller} />;
  return null;
}

export function TopologyDiagramCanvas({ controller }) {
  const {
    actions,
    canEdit,
    creating,
    diagram,
    environment,
    flowRevision,
    hiddenIntegrationIds,
    hiddenServerIds,
    loading,
    nodes,
    selectedEdge,
    selectedElement,
    selectedGroup,
    topologyLoading,
    visibleGraph,
  } = controller;

  function clearSelection() {
    actions.setSelectedEdgeId("");
    actions.setSelectedElementId("");
    actions.setSelectedGroupId("");
  }

  function selectEdge(edge) {
    actions.setSelectedEdgeId(edge.id);
    actions.setSelectedElementId("");
    actions.setSelectedGroupId("");
  }

  function selectNode(node) {
    actions.setSelectedEdgeId("");
    actions.setSelectedElementId(
      node.type === "topologyElement" ? node.id : "",
    );
    actions.setSelectedGroupId(node.type === "topologyGroup" ? node.id : "");
  }

  function finishNodeDrag(draggedNode) {
    const positionedNodes = nodes.map((node) =>
      node.id === draggedNode.id
        ? { ...node, position: draggedNode.position }
        : node,
    );
    actions.setEdges((current) =>
      actions.routeTopologyEdges(positionedNodes, current),
    );
  }

  return (
    <div className="topologyDiagramCanvas">
      {loading || topologyLoading ? (
        <div className="topologyDiagramLoading">Carregando topologia…</div>
      ) : null}
      {!loading && !diagram && !creating ? (
        <div className="topologyDiagramLoading">Nenhum gráfico disponível.</div>
      ) : null}
      {diagram ? (
        <ReactFlow
          key={`${diagram.id}-${environment}-${flowRevision}-${hiddenIntegrationIds.join(",")}-${hiddenServerIds.join(",")}`}
          colorMode="light"
          connectionMode={ConnectionMode.Loose}
          edges={visibleGraph.edges}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          isValidConnection={({ source, target }) => source !== target}
          nodeTypes={nodeTypes}
          nodes={visibleGraph.nodes}
          nodesConnectable={canEdit}
          nodesDraggable={canEdit}
          onConnect={actions.connect}
          onEdgeClick={(_event, edge) => selectEdge(edge)}
          onEdgesChange={actions.changeEdges}
          onNodeClick={(_event, node) => selectNode(node)}
          onNodeDragStop={(_event, node) => finishNodeDrag(node)}
          onNodesChange={actions.changeNodes}
          onPaneClick={clearSelection}
        >
          <Background gap={22} size={1} />
          <Controls position="top-left" />
          <MiniMap
            maskColor="rgba(226, 232, 240, 0.55)"
            nodeColor="#dbeafe"
            pannable
            position="top-right"
            zoomable
          />
          {!visibleGraph.nodes.length && nodes.length ? (
            <Panel className="topologyDiagramEmptyFilter" position="top-center">
              Nenhum elemento corresponde aos filtros de exibição.
            </Panel>
          ) : null}
          <SelectedEditor
            controller={controller}
            selectedEdge={selectedEdge}
            selectedElement={selectedElement}
            selectedGroup={selectedGroup}
          />
          <CommentsPanel controller={controller} />
        </ReactFlow>
      ) : null}
    </div>
  );
}
