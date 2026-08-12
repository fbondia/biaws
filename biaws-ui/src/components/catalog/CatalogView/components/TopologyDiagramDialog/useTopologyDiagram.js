import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createTopologyDiagram,
  fetchComponents,
  fetchDeployments,
  fetchRuntimes,
  fetchTopologyDiagram,
  fetchTopologyDiagrams,
  updateTopologyDiagram,
} from "../../../../../api.js";
import { hasPermission } from "../../../../../permissions.js";
import { useMessages } from "../../../../../infrastructure/messages/MessagesProvider.jsx";
import {
  automaticTopologyHandles,
  buildTopologyGraph,
  filterTopologyGraph,
  routeTopologyEdges,
  resizeTopologyGroups,
  topologyConnectionLabel,
  topologyDiagramPayload,
} from "../../topologyDiagramModel.js";

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

export function useTopologyDiagram({ actor, context, onClose }) {
  const { confirm } = useMessages();
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

  async function requestClose() {
    if (
      dirty &&
      !(await confirm("Descartar as alterações não salvas deste gráfico?"))
    ) {
      return;
    }
    onClose();
  }

  async function selectDiagram(diagramId) {
    if (
      dirty &&
      !(await confirm("Descartar as alterações não salvas deste gráfico?"))
    ) {
      return;
    }
    void openDiagram(diagramId);
  }

  async function startCreating() {
    if (
      dirty &&
      !(await confirm("Descartar as alterações não salvas deste gráfico?"))
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
          ...automaticTopologyHandles(
            nodes,
            connection.source,
            connection.target,
          ),
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

  return {
    actions: {
      changeEdges,
      changeEnvironment,
      changeNodes,
      connect,
      createDiagram,
      createElement,
      createGroup,
      removeSelectedEdge,
      removeSelectedElement,
      removeSelectedGroup,
      requestClose,
      routeTopologyEdges,
      saveDiagram,
      selectDiagram,
      setComments,
      setCreating,
      setDirty,
      setEdges,
      setHiddenIntegrationIds,
      setHiddenServerIds,
      setNewEnvironment,
      setNewName,
      setSelectedEdgeId,
      setSelectedElementId,
      setSelectedGroupId,
      startCreating,
      toggleNodeInSelectedGroup,
      updateSelectedEdge,
      updateSelectedElement,
      updateSelectedGroup,
    },
    canEdit,
    comments,
    creating,
    diagram,
    diagrams,
    dirty,
    edges,
    environment,
    error,
    flowRevision,
    groupableNodes,
    hasUntitledNode,
    hiddenIntegrationIds,
    hiddenServerIds,
    integrationOptions,
    integrationWarning,
    loading,
    newEnvironment,
    newName,
    nodes,
    saving,
    selectedDeployments,
    selectedEdge,
    selectedElement,
    selectedElementType,
    selectedGroup,
    selectedId,
    serverOptions,
    topologyLoading,
    visibleDeploymentCount,
    visibleGraph,
  };
}
