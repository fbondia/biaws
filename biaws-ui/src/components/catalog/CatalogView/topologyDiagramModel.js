import { resizeTopologyGroups } from "./topologyDiagramLayout.js";

export {
  automaticTopologyHandles,
  resizeTopologyGroups,
  routeTopologyEdges,
} from "./topologyDiagramLayout.js";

export const TOPOLOGY_ENVIRONMENTS = Object.freeze([
  { value: "production", label: "Produção" },
  { value: "staging", label: "Homologação" },
  { value: "test", label: "Teste" },
  { value: "development", label: "Desenvolvimento" },
  { value: "other", label: "Outro" },
]);

export const TOPOLOGY_CONNECTION_TYPES = Object.freeze([
  { value: "api", label: "API / HTTP" },
  { value: "database", label: "Banco de dados" },
  { value: "messaging", label: "Mensageria" },
  { value: "cache", label: "Cache" },
  { value: "file", label: "Arquivo" },
  { value: "network", label: "Rede" },
  { value: "dependency", label: "Dependência" },
  { value: "other", label: "Outra" },
]);
export const TOPOLOGY_CONNECTION_DIRECTIONS = Object.freeze([
  { value: "none", label: "Sem seta" },
  { value: "forward", label: "Origem → destino" },
  { value: "reverse", label: "Destino → origem" },
  { value: "both", label: "Bidirecional" },
]);
export const TOPOLOGY_CONNECTION_LINE_TYPES = Object.freeze([
  { value: "default", label: "Curva" },
  { value: "smoothstep", label: "Ângulos arredondados" },
  { value: "step", label: "Ângulos retos" },
  { value: "straight", label: "Linha reta" },
]);

const connectionLabels = Object.fromEntries(
  TOPOLOGY_CONNECTION_TYPES.map(({ label, value }) => [value, label]),
);
const GROUP_MIN_WIDTH = 640;
const GROUP_MIN_HEIGHT = 380;

export function topologyConnectionLabel(connectionType, label = "") {
  return label.trim() || connectionLabels[connectionType] || connectionType;
}

function defaultPosition(index) {
  return {
    x: (index % 3) * 340,
    y: Math.floor(index / 3) * 260,
  };
}

function defaultIntegrationPosition(index) {
  return {
    x: -340,
    y: index * 210,
  };
}

function defaultGroupPosition(index) {
  return {
    x: index * 680,
    y: -460,
  };
}

function defaultElementPosition(index) {
  return {
    x: -680,
    y: index * 210,
  };
}

function runtimeNodeId(runtime) {
  return runtime.serverId
    ? `server:${runtime.serverId}`
    : `runtime:${runtime.id}`;
}

export function buildTopologyGraph({
  components = [],
  deployments = [],
  integrations = [],
  runtimes = [],
  savedEdges = [],
  savedElements = [],
  savedGroups = [],
  savedNodes = [],
  servers = [],
}) {
  const componentsById = new Map(
    components.map((component) => [component.id, component]),
  );
  const deploymentsById = new Map(
    deployments.map((deployment) => [deployment.id, deployment]),
  );
  const serversById = new Map(servers.map((server) => [server.id, server]));
  const savedNodesById = new Map(savedNodes.map((node) => [node.id, node]));
  const groupIds = new Set(savedGroups.map(({ id }) => id));
  const runtimeGroups = new Map();

  function nodePlacement(id, fallback) {
    const saved = savedNodesById.get(id);
    const parentId =
      saved?.parentId && groupIds.has(saved.parentId)
        ? saved.parentId
        : undefined;
    return {
      position: saved?.position || fallback,
      ...(parentId ? { parentId, extent: "parent", expandParent: true } : {}),
    };
  }

  runtimes.forEach((runtime) => {
    const deployment = deploymentsById.get(runtime.deploymentId);
    if (!deployment) return;
    const component = componentsById.get(deployment.componentId);
    const nodeId = runtimeNodeId(runtime);
    const server = runtime.serverId ? serversById.get(runtime.serverId) : null;
    const current = runtimeGroups.get(nodeId) || {
      id: nodeId,
      server: server || {
        id: "",
        name: `${runtime.name} · gerenciado/externo`,
        hostname: runtime.endpoint || "",
        status: runtime.status,
      },
      components: new Map(),
    };
    const componentId = component?.id || deployment.componentId;
    const componentGroup = current.components.get(componentId) || {
      id: componentId,
      name: component?.name || componentId,
      applicationName: component?.applicationName || "",
      integrated: Boolean(component?.integrated),
      integrationId: component?.integrationId || "",
      runtimes: [],
    };
    componentGroup.runtimes.push({
      id: runtime.id,
      name: runtime.name,
      kind: runtime.kind,
      status: runtime.status,
      endpoint: runtime.endpoint || "",
    });
    current.components.set(componentId, componentGroup);
    runtimeGroups.set(nodeId, current);
  });

  const groupNodes = savedGroups.map((group, index) => ({
    id: group.id,
    type: "topologyGroup",
    deletable: false,
    position:
      savedNodesById.get(group.id)?.position || defaultGroupPosition(index),
    style: { width: GROUP_MIN_WIDTH, height: GROUP_MIN_HEIGHT },
    data: { group },
  }));
  const serverNodes = [...runtimeGroups.values()]
    .sort((left, right) =>
      left.server.name.localeCompare(right.server.name, "pt-BR"),
    )
    .map((group, index) => ({
      id: group.id,
      type: "topologyServer",
      deletable: false,
      ...nodePlacement(group.id, defaultPosition(index)),
      data: {
        server: group.server,
        managed: group.id.startsWith("runtime:"),
        components: [...group.components.values()].sort((left, right) =>
          left.name.localeCompare(right.name, "pt-BR"),
        ),
      },
    }));
  const integrationNodes = integrations
    .sort((left, right) =>
      left.application.name.localeCompare(right.application.name, "pt-BR"),
    )
    .map((integration, index) => {
      const id = `integration:${integration.id}`;
      return {
        id,
        type: "topologyIntegration",
        deletable: false,
        ...nodePlacement(id, defaultIntegrationPosition(index)),
        data: integration,
      };
    });
  const elementNodes = savedElements.map((element, index) => ({
    id: element.id,
    type: "topologyElement",
    deletable: false,
    ...nodePlacement(element.id, defaultElementPosition(index)),
    data: { element },
  }));
  const nodes = resizeTopologyGroups([
    ...groupNodes,
    ...elementNodes,
    ...integrationNodes,
    ...serverNodes,
  ]);
  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edges = savedEdges
    .filter(({ source, target }) => nodeIds.has(source) && nodeIds.has(target))
    .map((edge) => ({
      ...edge,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
      type: edge.lineType || "default",
      label: topologyConnectionLabel(edge.connectionType, edge.label),
      data: {
        connectionType: edge.connectionType,
        direction: edge.direction || "forward",
        customLabel: edge.label || "",
      },
    }));

  return { nodes, edges };
}

export function filterTopologyGraph({
  edges = [],
  hiddenIntegrationIds = [],
  hiddenServerIds = [],
  nodes = [],
}) {
  const hiddenIntegrations = new Set(hiddenIntegrationIds);
  const hiddenServers = new Set(hiddenServerIds);
  const visibleNodes = nodes.flatMap((node) => {
    if (node.type === "topologyGroup" || node.type === "topologyElement") {
      return [node];
    }
    if (node.type === "topologyIntegration") {
      return hiddenIntegrations.has(node.data?.integration?.id) ? [] : [node];
    }
    if (!node.data?.managed && hiddenServers.has(node.data?.server?.id)) {
      return [];
    }

    const components = (node.data?.components || []).filter(
      (component) =>
        !component.integrationId ||
        !hiddenIntegrations.has(component.integrationId),
    );
    if (!components.length) return [];

    return [
      {
        ...node,
        data: {
          ...node.data,
          components,
        },
      },
    ];
  });
  const visibleNodeIds = new Set(visibleNodes.map(({ id }) => id));

  return {
    nodes: visibleNodes,
    edges: edges.filter(
      ({ source, target }) =>
        visibleNodeIds.has(source) && visibleNodeIds.has(target),
    ),
  };
}

export function topologyDiagramPayload({
  comments,
  edges,
  environment,
  hiddenIntegrationIds = [],
  hiddenServerIds = [],
  name,
  nodes,
}) {
  return {
    name: name.trim(),
    environment,
    hiddenIntegrationIds,
    hiddenServerIds,
    groups: nodes
      .filter(({ type }) => type === "topologyGroup")
      .map(({ id, data }) => ({
        id,
        title: data.group.title,
        description: data.group.description || "",
      })),
    elements: nodes
      .filter(({ type }) => type === "topologyElement")
      .map(({ id, data }) => ({
        id,
        type: data.element.type?.trim() || "Elemento",
        title: data.element.title,
        description: data.element.description || "",
        headerColor: data.element.headerColor || "#edf9f5",
      })),
    nodes: nodes.map(({ id, parentId, position }) => ({
      id,
      position,
      ...(parentId ? { parentId } : {}),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || "",
      targetHandle: edge.targetHandle || "",
      connectionType: edge.data?.connectionType || "dependency",
      direction: edge.data?.direction || "forward",
      lineType: edge.type || "default",
      label: edge.data?.customLabel || "",
    })),
    comments,
  };
}
