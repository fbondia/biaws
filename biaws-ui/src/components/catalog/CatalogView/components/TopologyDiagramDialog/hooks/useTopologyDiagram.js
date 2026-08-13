import { useEffect, useMemo, useRef, useState } from "react";

import {
  createTopologyDiagram,
  fetchTopologyDiagram,
  fetchTopologyDiagrams,
  updateTopologyDiagram,
} from "../../../../../../api.js";
import { useMessages } from "../../../../../../infrastructure/messages/MessagesProvider.jsx";
import { hasPermission } from "../../../../../../permissions.js";
import {
  filterTopologyGraph,
  routeTopologyEdges,
  topologyDiagramPayload,
} from "../models/topologyDiagramModel.js";
import { createTopologyEditorActions } from "./createTopologyEditorActions.js";
import { createTopologyEnvironmentLoader } from "./createTopologyEnvironmentLoader.js";
import { diagramSummary } from "../models/topologyDiagramPresentation.js";

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

  const loadEnvironment = createTopologyEnvironmentLoader({
    comments,
    context,
    diagram,
    edges,
    hiddenIntegrationIds,
    hiddenServerIds,
    nodes,
    topologyRequest,
    setters: {
      setEdges,
      setError,
      setFlowRevision,
      setIntegrationWarning,
      setNodes,
      setSelectedEdgeId,
      setSelectedElementId,
      setSelectedGroupId,
      setTopologyLoading,
      setVisibleDeploymentCount,
    },
  });
  const editorActions = createTopologyEditorActions({
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
  });

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
      ...editorActions,
      changeEnvironment,
      createDiagram,
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
