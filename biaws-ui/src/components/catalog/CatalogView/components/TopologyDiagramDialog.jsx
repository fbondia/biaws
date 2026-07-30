import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
} from "@xyflow/react";
import { Box, Layers3, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createTopologyDiagram,
  fetchComponents,
  fetchDeployments,
  fetchRuntimes,
  fetchTopologyDiagram,
  fetchTopologyDiagrams,
  updateTopologyDiagram,
} from "../../../../api.js";
import { hasPermission } from "../../../../permissions.js";
import {
  buildTopologyGraph,
  filterTopologyGraph,
  resizeTopologyGroups,
  TOPOLOGY_CONNECTION_DIRECTIONS,
  TOPOLOGY_CONNECTION_LINE_TYPES,
  TOPOLOGY_CONNECTION_TYPES,
  TOPOLOGY_ENVIRONMENTS,
  topologyConnectionLabel,
  topologyDiagramPayload,
} from "../topologyDiagramModel.js";
import { TopologyElementNode } from "./TopologyElementNode.jsx";
import { TopologyGroupNode } from "./TopologyGroupNode.jsx";
import { TopologyIntegrationNode } from "./TopologyIntegrationNode.jsx";
import { TopologyServerNode } from "./TopologyServerNode.jsx";

const nodeTypes = {
  topologyElement: TopologyElementNode,
  topologyGroup: TopologyGroupNode,
  topologyIntegration: TopologyIntegrationNode,
  topologyServer: TopologyServerNode,
};

function edgeDirectionMarkers(direction = "forward") {
  const marker = { type: MarkerType.ArrowClosed };
  return {
    markerStart:
      direction === "reverse" || direction === "both" ? marker : undefined,
    markerEnd:
      direction === "forward" || direction === "both" ? marker : undefined,
  };
}

function diagramSummary(diagram) {
  return {
    id: diagram.id,
    name: diagram.name,
    environment: diagram.environment,
    updatedAt: diagram.updatedAt,
    updatedBy: diagram.updatedBy,
  };
}

function TopologyVisibilityMenu({ hiddenIds, label, onChange, options }) {
  const hidden = new Set(hiddenIds);
  const visibleCount = options.filter(({ id }) => !hidden.has(id)).length;

  function toggle(id, visible) {
    const next = new Set(hiddenIds);
    if (visible) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <details className="topologyDiagramVisibilityMenu">
      <summary>
        <span>{label}</span>
        <small>
          {visibleCount}/{options.length}
        </small>
      </summary>
      <div className="topologyDiagramVisibilityPopover">
        <header>
          <strong>{label}</strong>
          {options.length ? (
            <span>
              <button onClick={() => onChange([])} type="button">
                Todos
              </button>
              <button
                onClick={() => onChange(options.map(({ id }) => id))}
                type="button"
              >
                Nenhum
              </button>
            </span>
          ) : null}
        </header>
        <div className="topologyDiagramVisibilityOptions">
          {options.length ? (
            options.map((option) => (
              <label key={option.id}>
                <input
                  checked={!hidden.has(option.id)}
                  onChange={(event) => toggle(option.id, event.target.checked)}
                  type="checkbox"
                />
                <span title={option.label}>{option.label}</span>
              </label>
            ))
          ) : (
            <small>Nenhum item disponível neste ambiente.</small>
          )}
        </div>
      </div>
    </details>
  );
}

export function TopologyDiagramDialog({ actor, context, onClose }) {
  const [diagrams, setDiagrams] = useState([]);
  const [diagram, setDiagram] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [comments, setComments] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [selectedElementId, setSelectedElementId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEnvironment, setNewEnvironment] = useState("production");
  const [loading, setLoading] = useState(true);
  const [topologyLoading, setTopologyLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [integrationWarning, setIntegrationWarning] = useState("");
  const [visibleDeploymentCount, setVisibleDeploymentCount] = useState(0);
  const [hiddenIntegrationIds, setHiddenIntegrationIds] = useState([]);
  const [hiddenServerIds, setHiddenServerIds] = useState([]);
  const [flowRevision, setFlowRevision] = useState(0);
  const topologyRequest = useRef(0);
  const canEdit = hasPermission(actor, "applications.update");

  const visibleGraph = useMemo(
    () =>
      filterTopologyGraph({
        nodes,
        edges,
        hiddenIntegrationIds,
        hiddenServerIds,
      }),
    [edges, hiddenIntegrationIds, hiddenServerIds, nodes],
  );
  const integrationOptions = useMemo(
    () =>
      nodes
        .filter(({ type }) => type === "topologyIntegration")
        .map(({ data }) => ({
          id: data.integration.id,
          label: data.application.name,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [nodes],
  );
  const serverOptions = useMemo(
    () =>
      nodes
        .filter(
          ({ type, data }) =>
            type === "topologyServer" && !data.managed && data.server?.id,
        )
        .map(({ data }) => ({
          id: data.server.id,
          label: data.server.name,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [nodes],
  );
  const selectedEdge =
    visibleGraph.edges.find(({ id }) => id === selectedEdgeId) || null;
  const selectedGroup =
    nodes.find(
      ({ id, type }) => id === selectedGroupId && type === "topologyGroup",
    ) || null;
  const selectedElement =
    nodes.find(
      ({ id, type }) => id === selectedElementId && type === "topologyElement",
    ) || null;
  const hasUntitledNode = nodes.some(
    ({ type, data }) =>
      (type === "topologyGroup" && !data.group.title.trim()) ||
      (type === "topologyElement" &&
        (!(
          data.element.type === undefined ? "Elemento" : data.element.type
        ).trim() ||
          !data.element.title.trim())),
  );
  const selectedElementType =
    selectedElement?.data.element.type === undefined
      ? "Elemento"
      : selectedElement?.data.element.type || "";
  const groupableNodes = useMemo(
    () =>
      nodes
        .filter(
          ({ type }) =>
            type === "topologyElement" ||
            type === "topologyIntegration" ||
            type === "topologyServer",
        )
        .map((node) => ({
          id: node.id,
          label:
            node.type === "topologyElement"
              ? node.data.element.title
              : node.type === "topologyIntegration"
                ? node.data.application.name
                : node.data.server.name,
          parentId: node.parentId || "",
          type: node.type,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [nodes],
  );
  const selectedDeployments = useMemo(
    () =>
      context.deployments.filter(
        (deployment) => deployment.environment === environment,
      ),
    [context.deployments, environment],
  );

  async function loadEnvironment(
    nextEnvironment,
    sourceDiagram = diagram,
    { preserveCurrentPositions = false } = {},
  ) {
    const requestId = topologyRequest.current + 1;
    topologyRequest.current = requestId;
    setTopologyLoading(true);
    setError("");
    setIntegrationWarning("");
    setVisibleDeploymentCount(0);
    try {
      const localDeployments = context.deployments.filter(
        (deployment) => deployment.environment === nextEnvironment,
      );
      const localRuntimeGroups = await Promise.all(
        localDeployments.map((deployment) =>
          fetchRuntimes(deployment.id, { limit: 100 }),
        ),
      );
      const applicationsById = new Map(
        (context.availableApplications || []).map((application) => [
          application.id,
          application,
        ]),
      );
      const integratedResults = await Promise.allSettled(
        (context.integrations || []).map(async (integration) => {
          const application =
            applicationsById.get(integration.targetApplicationId) || {};
          const [componentsPayload, deploymentsPayload] = await Promise.all([
            fetchComponents(integration.targetApplicationId, { limit: 100 }),
            fetchDeployments(integration.targetApplicationId, { limit: 100 }),
          ]);
          const deployments = (deploymentsPayload.items || []).filter(
            (deployment) => deployment.environment === nextEnvironment,
          );
          const runtimeGroups = await Promise.all(
            deployments.map((deployment) =>
              fetchRuntimes(deployment.id, { limit: 100 }),
            ),
          );
          return {
            integration,
            application: {
              id: integration.targetApplicationId,
              key: application.key || "",
              name: application.name || integration.targetApplicationId,
              status: application.status || integration.status,
            },
            components: (componentsPayload.items || []).map((component) => ({
              ...component,
              applicationName:
                application.name || integration.targetApplicationId,
              integrated: true,
              integrationId: integration.id,
            })),
            deployments,
            runtimes: runtimeGroups.flatMap(({ items }) => items || []),
          };
        }),
      );
      if (requestId !== topologyRequest.current) return;
      const integratedTopology = integratedResults
        .filter(({ status }) => status === "fulfilled")
        .map(({ value }) => value);
      const unavailableIntegrations = integratedResults.filter(
        ({ status }) => status === "rejected",
      ).length;
      if (unavailableIntegrations) {
        setIntegrationWarning(
          `${unavailableIntegrations} integração(ões) não pôde(ram) ser carregada(s) com as permissões atuais.`,
        );
      }
      const components = [
        ...context.components.map((component) => ({
          ...component,
          applicationName: context.application.name,
          integrated: false,
        })),
        ...integratedTopology.flatMap(({ components }) => components),
      ];
      const deployments = [
        ...localDeployments,
        ...integratedTopology.flatMap(({ deployments }) => deployments),
      ];
      setVisibleDeploymentCount(deployments.length);
      const runtimes = [
        ...localRuntimeGroups.flatMap(({ items }) => items || []),
        ...integratedTopology.flatMap(({ runtimes }) => runtimes),
      ];
      const integratedTopologyById = new Map(
        integratedTopology.map((result) => [result.integration.id, result]),
      );
      const integrations = (context.integrations || []).map((integration) => {
        const loaded = integratedTopologyById.get(integration.id);
        const application =
          applicationsById.get(integration.targetApplicationId) || {};
        return {
          id: integration.id,
          integration,
          application: loaded?.application || {
            id: integration.targetApplicationId,
            key: application.key || "",
            name: application.name || integration.name,
            status: application.status || integration.status,
          },
          componentCount: loaded?.components.length || 0,
          deploymentCount: loaded?.deployments.length || 0,
          runtimeCount: loaded?.runtimes.length || 0,
          topologyUnavailable: !loaded,
        };
      });
      const savedNodes = preserveCurrentPositions
        ? nodes.map(({ id, parentId, position }) => ({
            id,
            position,
            ...(parentId ? { parentId } : {}),
          }))
        : sourceDiagram?.nodes || [];
      const savedEdges = preserveCurrentPositions
        ? topologyDiagramPayload({
            name: sourceDiagram?.name || "Rascunho",
            environment: nextEnvironment,
            nodes,
            edges,
            comments,
            hiddenIntegrationIds,
            hiddenServerIds,
          }).edges
        : sourceDiagram?.edges || [];
      const savedGroups = preserveCurrentPositions
        ? nodes
            .filter(({ type }) => type === "topologyGroup")
            .map(({ id, data }) => ({
              id,
              title: data.group.title,
              description: data.group.description || "",
            }))
        : sourceDiagram?.groups || [];
      const savedElements = preserveCurrentPositions
        ? nodes
            .filter(({ type }) => type === "topologyElement")
            .map(({ id, data }) => ({
              id,
              title: data.element.title,
              description: data.element.description || "",
            }))
        : sourceDiagram?.elements || [];
      const graph = buildTopologyGraph({
        components,
        deployments,
        integrations,
        runtimes,
        savedElements,
        servers: context.servers,
        savedNodes,
        savedEdges,
        savedGroups,
      });
      setNodes(graph.nodes);
      setEdges(
        graph.edges.map((edge) => ({
          ...edge,
          ...edgeDirectionMarkers(edge.data?.direction),
        })),
      );
      setSelectedEdgeId("");
      setSelectedElementId("");
      setSelectedGroupId("");
      setFlowRevision((current) => current + 1);
    } catch (loadError) {
      if (requestId === topologyRequest.current) {
        setError(loadError.message);
        setVisibleDeploymentCount(0);
        setNodes([]);
        setEdges([]);
      }
    } finally {
      if (requestId === topologyRequest.current) setTopologyLoading(false);
    }
  }

  async function openDiagram(diagramId) {
    if (!diagramId) return;
    setSelectedId(diagramId);
    setLoading(true);
    setError("");
    try {
      const payload = await fetchTopologyDiagram(diagramId);
      const nextDiagram = payload.diagram;
      setDiagram(nextDiagram);
      setEnvironment(nextDiagram.environment);
      setComments(nextDiagram.comments || "");
      setHiddenIntegrationIds(nextDiagram.hiddenIntegrationIds || []);
      setHiddenServerIds(nextDiagram.hiddenServerIds || []);
      setSelectedElementId("");
      setSelectedGroupId("");
      setDirty(false);
      setCreating(false);
      await loadEnvironment(nextDiagram.environment, nextDiagram);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function requestClose() {
    if (
      dirty &&
      !window.confirm("Descartar as alterações não salvas deste gráfico?")
    ) {
      return;
    }
    onClose();
  }

  function selectDiagram(diagramId) {
    if (
      dirty &&
      !window.confirm("Descartar as alterações não salvas deste gráfico?")
    ) {
      return;
    }
    void openDiagram(diagramId);
  }

  function startCreating() {
    if (
      dirty &&
      !window.confirm("Descartar as alterações não salvas deste gráfico?")
    ) {
      return;
    }
    setCreating(true);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTopologyDiagrams(context.application.id, { limit: 100 })
      .then(async (payload) => {
        if (!active) return;
        const items = payload.items || [];
        setDiagrams(items);
        if (items.length) {
          await openDiagram(items[0].id);
        } else {
          setCreating(canEdit);
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      topologyRequest.current += 1;
    };
  }, [context.application.id]);

  function changeNodes(changes) {
    const allowedChanges = changes.filter(
      ({ type }) => type !== "remove" && (canEdit || type !== "position"),
    );
    setNodes((current) => applyNodeChanges(allowedChanges, current));
    if (allowedChanges.some(({ type }) => type === "position")) {
      setDirty(true);
    }
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
          id,
          type: "default",
          ...edgeDirectionMarkers("forward"),
          label: topologyConnectionLabel(connectionType),
          data: {
            connectionType,
            direction: "forward",
            customLabel: "",
          },
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
        position: {
          x: 80 + groupCount * 36,
          y: 80 + groupCount * 36,
        },
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
        position: {
          x: 120 + elementCount * 36,
          y: 120 + elementCount * 36,
        },
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

  async function changeEnvironment(nextEnvironment) {
    setEnvironment(nextEnvironment);
    setDirty(true);
    await loadEnvironment(nextEnvironment, diagram, {
      preserveCurrentPositions: true,
    });
  }

  async function createDiagram(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    try {
      const payload = await createTopologyDiagram(context.application.id, {
        name,
        environment: newEnvironment,
        nodes: [],
        edges: [],
        comments: "",
        elements: [],
        groups: [],
        hiddenIntegrationIds: [],
        hiddenServerIds: [],
      });
      const created = payload.diagram;
      setDiagrams((current) => [diagramSummary(created), ...current]);
      setNewName("");
      await openDiagram(created.id);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDiagram() {
    if (!diagram || !canEdit) return;
    setSaving(true);
    setError("");
    try {
      const payload = await updateTopologyDiagram(
        diagram.id,
        topologyDiagramPayload({
          name: diagram.name,
          environment,
          nodes,
          edges,
          comments,
          hiddenIntegrationIds,
          hiddenServerIds,
        }),
      );
      const updated = payload.diagram;
      setDiagram(updated);
      setDiagrams((current) =>
        current.map((item) =>
          item.id === updated.id ? diagramSummary(updated) : item,
        ),
      );
      setDirty(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialogBackdrop topologyDiagramBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) requestClose();
      }}
    >
      <section
        aria-labelledby="topology-diagram-title"
        aria-modal="true"
        className="topologyDiagramDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Topologia gráfica</span>
            <h2 id="topology-diagram-title">{context.application.name}</h2>
          </div>
          <button
            aria-label="Fechar visualização"
            className="iconButton"
            disabled={saving}
            onClick={requestClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="topologyDiagramToolbar">
          <div className="topologyDiagramToolbarPrimary">
            <div className="topologyDiagramSelectors">
              <label className="field topologyDiagramSelector">
                <span>Gráfico</span>
                <select
                  disabled={loading || saving}
                  onChange={(event) => selectDiagram(event.target.value)}
                  value={selectedId}
                >
                  {!diagrams.length ? (
                    <option value="">Nenhum gráfico criado</option>
                  ) : null}
                  {diagrams.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {canEdit ? (
                <button
                  className="secondaryButton topologyDiagramNewButton"
                  onClick={startCreating}
                  type="button"
                >
                  <Plus size={15} /> Novo gráfico
                </button>
              ) : null}
              <label className="field topologyDiagramEnvironment">
                <span>Ambiente</span>
                <select
                  disabled={!diagram || topologyLoading || !canEdit}
                  onChange={(event) =>
                    void changeEnvironment(event.target.value)
                  }
                  value={environment}
                >
                  {TOPOLOGY_ENVIRONMENTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="topologyDiagramToolbarActions">
              {dirty ? <small>Alterações não salvas</small> : null}
              {canEdit ? (
                <button
                  className="primaryButton"
                  disabled={
                    !diagram ||
                    saving ||
                    topologyLoading ||
                    !dirty ||
                    hasUntitledNode
                  }
                  onClick={() => void saveDiagram()}
                  type="button"
                >
                  <Save size={15} /> {saving ? "Salvando…" : "Salvar"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="topologyDiagramToolbarSecondary">
            {/*
            <span className="topologyDiagramDeploymentCount">
              {visibleDeploymentCount || selectedDeployments.length}{" "}
              deployment(s)
            </span>
            */}
            <div className="topologyDiagramToolbarGroup">
              <span className="topologyDiagramToolbarLabel">Exibir</span>
              <div className="topologyDiagramVisibility">
                <TopologyVisibilityMenu
                  hiddenIds={hiddenIntegrationIds}
                  label="Integrações"
                  onChange={(next) => {
                    setHiddenIntegrationIds(next);
                    setSelectedEdgeId("");
                    if (canEdit) setDirty(true);
                  }}
                  options={integrationOptions}
                />
                <TopologyVisibilityMenu
                  hiddenIds={hiddenServerIds}
                  label="Servidores"
                  onChange={(next) => {
                    setHiddenServerIds(next);
                    setSelectedEdgeId("");
                    if (canEdit) setDirty(true);
                  }}
                  options={serverOptions}
                />
              </div>
            </div>
            {canEdit ? (
              <div className="topologyDiagramToolbarGroup topologyDiagramAddGroup">
                <span className="topologyDiagramToolbarLabel">Adicionar</span>
                <div className="topologyDiagramCreateNodes">
                  <button
                    className="secondaryButton"
                    disabled={!diagram || topologyLoading}
                    onClick={createElement}
                    type="button"
                  >
                    <Box size={15} /> Elemento
                  </button>
                  <button
                    className="secondaryButton"
                    disabled={!diagram || topologyLoading}
                    onClick={createGroup}
                    type="button"
                  >
                    <Layers3 size={15} /> Grupo
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {creating ? (
          <form className="topologyDiagramCreate" onSubmit={createDiagram}>
            <label className="field">
              <span>Nome do novo gráfico</span>
              <input
                autoFocus
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ex.: Produção principal"
                value={newName}
              />
            </label>
            <label className="field">
              <span>Ambiente inicial</span>
              <select
                onChange={(event) => setNewEnvironment(event.target.value)}
                value={newEnvironment}
              >
                {TOPOLOGY_ENVIRONMENTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primaryButton"
              disabled={!newName.trim() || saving}
              type="submit"
            >
              Criar
            </button>
            {diagrams.length ? (
              <button
                className="secondaryButton"
                onClick={() => setCreating(false)}
                type="button"
              >
                Cancelar
              </button>
            ) : null}
          </form>
        ) : null}

        {error ? <div className="errorBox">{error}</div> : null}
        {integrationWarning ? (
          <div className="warningBox">{integrationWarning}</div>
        ) : null}

        <div className="topologyDiagramCanvas">
          {loading || topologyLoading ? (
            <div className="topologyDiagramLoading">Carregando topologia…</div>
          ) : null}
          {!loading && !diagram && !creating ? (
            <div className="topologyDiagramLoading">
              Nenhum gráfico disponível.
            </div>
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
              onConnect={connect}
              onEdgeClick={(_event, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedElementId("");
                setSelectedGroupId("");
              }}
              onEdgesChange={changeEdges}
              onNodeClick={(_event, node) => {
                setSelectedEdgeId("");
                setSelectedElementId(
                  node.type === "topologyElement" ? node.id : "",
                );
                setSelectedGroupId(
                  node.type === "topologyGroup" ? node.id : "",
                );
              }}
              onNodesChange={changeNodes}
              onPaneClick={() => {
                setSelectedEdgeId("");
                setSelectedElementId("");
                setSelectedGroupId("");
              }}
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
                <Panel
                  className="topologyDiagramEmptyFilter"
                  position="top-center"
                >
                  Nenhum elemento corresponde aos filtros de exibição.
                </Panel>
              ) : null}
              {selectedGroup ? (
                <Panel
                  className="topologyDiagramGroupEditor"
                  position="bottom-left"
                >
                  <strong>Grupo</strong>
                  <label className="field">
                    <span>Título</span>
                    <input
                      aria-invalid={!selectedGroup.data.group.title.trim()}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedGroup("title", event.target.value)
                      }
                      value={selectedGroup.data.group.title}
                    />
                  </label>
                  {!selectedGroup.data.group.title.trim() ? (
                    <small className="topologyDiagramGroupValidation">
                      Informe um título para salvar o diagrama.
                    </small>
                  ) : null}
                  <label className="field">
                    <span>Descrição</span>
                    <textarea
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedGroup("description", event.target.value)
                      }
                      rows={3}
                      value={selectedGroup.data.group.description || ""}
                    />
                  </label>
                  <div className="topologyDiagramGroupMembers">
                    <span>Elementos do grupo</span>
                    {groupableNodes.length ? (
                      groupableNodes.map((item) => (
                        <label key={item.id}>
                          <input
                            checked={item.parentId === selectedGroup.id}
                            disabled={!canEdit}
                            onChange={(event) =>
                              toggleNodeInSelectedGroup(
                                item.id,
                                event.target.checked,
                              )
                            }
                            type="checkbox"
                          />
                          <span>
                            {item.label}
                            {item.parentId &&
                            item.parentId !== selectedGroup.id ? (
                              <small>Em outro grupo</small>
                            ) : null}
                          </span>
                        </label>
                      ))
                    ) : (
                      <small>
                        Nenhum elemento, servidor ou integração disponível.
                      </small>
                    )}
                  </div>
                  {canEdit ? (
                    <button
                      className="dangerButton"
                      onClick={removeSelectedGroup}
                      type="button"
                    >
                      <Trash2 size={14} /> Remover grupo
                    </button>
                  ) : null}
                </Panel>
              ) : selectedElement ? (
                <Panel
                  className="topologyDiagramElementEditor"
                  position="bottom-left"
                >
                  <strong>Elemento</strong>
                  <label className="field">
                    <span>Tipo</span>
                    <input
                      aria-invalid={!selectedElementType.trim()}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedElement("type", event.target.value)
                      }
                      placeholder="Ex.: Firewall, serviço externo, domínio"
                      value={selectedElementType}
                    />
                  </label>
                  <label className="field">
                    <span>Título</span>
                    <input
                      aria-invalid={!selectedElement.data.element.title.trim()}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedElement("title", event.target.value)
                      }
                      value={selectedElement.data.element.title}
                    />
                  </label>
                  {!selectedElementType.trim() ||
                  !selectedElement.data.element.title.trim() ? (
                    <small className="topologyDiagramGroupValidation">
                      Informe o tipo e o título para salvar o diagrama.
                    </small>
                  ) : null}
                  <label className="field">
                    <span>Descrição</span>
                    <textarea
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedElement("description", event.target.value)
                      }
                      rows={4}
                      value={selectedElement.data.element.description || ""}
                    />
                  </label>
                  <label className="field topologyElementColorField">
                    <span>Cor do cabeçalho</span>
                    <div>
                      <input
                        aria-label="Cor do cabeçalho"
                        disabled={!canEdit}
                        onChange={(event) =>
                          updateSelectedElement(
                            "headerColor",
                            event.target.value,
                          )
                        }
                        type="color"
                        value={
                          selectedElement.data.element.headerColor || "#edf9f5"
                        }
                      />
                      <code>
                        {selectedElement.data.element.headerColor || "#edf9f5"}
                      </code>
                    </div>
                  </label>
                  {canEdit ? (
                    <button
                      className="dangerButton"
                      onClick={removeSelectedElement}
                      type="button"
                    >
                      <Trash2 size={14} /> Remover elemento
                    </button>
                  ) : null}
                </Panel>
              ) : selectedEdge ? (
                <Panel
                  className="topologyDiagramEdgeEditor"
                  position="bottom-left"
                >
                  <strong>Conexão</strong>
                  <label className="field">
                    <span>Tipo</span>
                    <select
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedEdge("connectionType", event.target.value)
                      }
                      value={selectedEdge.data?.connectionType || "dependency"}
                    >
                      {TOPOLOGY_CONNECTION_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Formato da linha</span>
                    <select
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedEdge("lineType", event.target.value)
                      }
                      value={selectedEdge.type || "default"}
                    >
                      {TOPOLOGY_CONNECTION_LINE_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Direção da seta</span>
                    <select
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedEdge("direction", event.target.value)
                      }
                      value={selectedEdge.data?.direction || "forward"}
                    >
                      {TOPOLOGY_CONNECTION_DIRECTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Rótulo opcional</span>
                    <input
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateSelectedEdge("customLabel", event.target.value)
                      }
                      value={selectedEdge.data?.customLabel || ""}
                    />
                  </label>
                  {canEdit ? (
                    <button
                      className="dangerButton"
                      onClick={removeSelectedEdge}
                      type="button"
                    >
                      <Trash2 size={14} /> Remover conexão
                    </button>
                  ) : null}
                </Panel>
              ) : null}
              <Panel
                className="topologyDiagramComments"
                position="bottom-right"
              >
                <label>
                  <strong>Comentários</strong>
                  <textarea
                    className="nodrag nopan"
                    disabled={!canEdit}
                    onChange={(event) => {
                      setComments(event.target.value);
                      setDirty(true);
                    }}
                    placeholder="Registre observações sobre este gráfico…"
                    rows={5}
                    value={comments}
                  />
                </label>
              </Panel>
            </ReactFlow>
          ) : null}
        </div>
      </section>
    </div>
  );
}
