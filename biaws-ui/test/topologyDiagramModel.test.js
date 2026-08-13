import assert from "node:assert/strict";
import test from "node:test";

import {
  automaticTopologyHandles,
  buildTopologyGraph,
  filterTopologyGraph,
  routeTopologyEdges,
  resizeTopologyGroups,
  topologyDiagramPayload,
} from "../src/components/catalog/CatalogView/components/TopologyDiagramDialog/models/topologyDiagramModel.js";

test("automatic topology handles follow the relative node position", () => {
  const source = {
    id: "source",
    position: { x: 400, y: 400 },
    measured: { width: 100, height: 100 },
  };
  const positions = [
    ["right", { x: 700, y: 400 }, "right", "left"],
    ["bottom-right", { x: 700, y: 700 }, "bottom-right", "top-left"],
    ["bottom", { x: 400, y: 700 }, "bottom", "top"],
    ["bottom-left", { x: 100, y: 700 }, "bottom-left", "top-right"],
    ["left", { x: 100, y: 400 }, "left", "right"],
    ["top-left", { x: 100, y: 100 }, "top-left", "bottom-right"],
    ["top", { x: 400, y: 100 }, "top", "bottom"],
    ["top-right", { x: 700, y: 100 }, "top-right", "bottom-left"],
  ];

  for (const [label, position, sourceHandle, targetHandle] of positions) {
    assert.deepEqual(
      automaticTopologyHandles(
        [
          source,
          {
            id: "target",
            position,
            measured: { width: 100, height: 100 },
          },
        ],
        "source",
        "target",
      ),
      { sourceHandle, targetHandle },
      label,
    );
  }
});

test("automatic topology handles use absolute positions for grouped nodes", () => {
  const nodes = [
    {
      id: "group",
      position: { x: 500, y: 200 },
      style: { width: 640, height: 380 },
    },
    {
      id: "source",
      parentId: "group",
      position: { x: 40, y: 100 },
      measured: { width: 100, height: 100 },
    },
    {
      id: "target",
      position: { x: 100, y: 300 },
      measured: { width: 100, height: 100 },
    },
  ];

  assert.deepEqual(automaticTopologyHandles(nodes, "source", "target"), {
    sourceHandle: "left",
    targetHandle: "right",
  });
});

test("topology edge routing replaces previously selected handles", () => {
  const nodes = [
    { id: "source", position: { x: 0, y: 0 } },
    { id: "target", position: { x: 400, y: 0 } },
  ];
  const [edge] = routeTopologyEdges(nodes, [
    {
      id: "edge-1",
      source: "source",
      target: "target",
      sourceHandle: "bottom",
      targetHandle: "top",
    },
  ]);

  assert.equal(edge.sourceHandle, "right");
  assert.equal(edge.targetHandle, "left");
});

test("topology graph groups components and runtimes by server", () => {
  const graph = buildTopologyGraph({
    components: [
      { id: "component-api", name: "API" },
      { id: "component-worker", name: "Worker" },
    ],
    deployments: [
      { id: "deployment-api", componentId: "component-api" },
      { id: "deployment-worker", componentId: "component-worker" },
    ],
    runtimes: [
      {
        id: "runtime-api",
        deploymentId: "deployment-api",
        serverId: "server-1",
        name: "API 1",
        kind: "container",
        status: "healthy",
      },
      {
        id: "runtime-worker",
        deploymentId: "deployment-worker",
        serverId: "server-1",
        name: "Worker 1",
        kind: "process",
        status: "healthy",
      },
    ],
    servers: [{ id: "server-1", name: "Produção 1", status: "active" }],
  });

  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0].id, "server:server-1");
  assert.deepEqual(
    graph.nodes[0].data.components.map(({ name }) => name),
    ["API", "Worker"],
  );
});

test("topology graph identifies integrated components on shared servers", () => {
  const graph = buildTopologyGraph({
    components: [
      { id: "component-local", name: "Portal", applicationName: "BIAWS" },
      {
        id: "component-integrated",
        name: "Identidade API",
        applicationName: "Identidade",
        integrated: true,
      },
    ],
    deployments: [
      { id: "deployment-local", componentId: "component-local" },
      { id: "deployment-integrated", componentId: "component-integrated" },
    ],
    runtimes: [
      {
        id: "runtime-local",
        deploymentId: "deployment-local",
        serverId: "server-1",
        name: "portal",
        kind: "container",
      },
      {
        id: "runtime-integrated",
        deploymentId: "deployment-integrated",
        serverId: "server-1",
        name: "identity-api",
        kind: "container",
      },
    ],
    servers: [{ id: "server-1", name: "Produção 1", status: "active" }],
  });

  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0].data.components.length, 2);
  const integrated = graph.nodes[0].data.components.find(
    ({ id }) => id === "component-integrated",
  );
  assert.equal(integrated.integrated, true);
  assert.equal(integrated.applicationName, "Identidade");
});

test("topology graph represents integrations without deployments or runtimes", () => {
  const graph = buildTopologyGraph({
    integrations: [
      {
        id: "integration-1",
        integration: {
          id: "integration-1",
          name: "Integração com ServiceNow",
          status: "active",
        },
        application: {
          id: "application-service-now",
          name: "ServiceNow",
          status: "active",
        },
        componentCount: 0,
        deploymentCount: 0,
        runtimeCount: 0,
        topologyUnavailable: false,
      },
    ],
  });

  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0].id, "integration:integration-1");
  assert.equal(graph.nodes[0].type, "topologyIntegration");
  assert.equal(graph.nodes[0].data.application.name, "ServiceNow");
});

test("topology graph restores groups before their child nodes", () => {
  const graph = buildTopologyGraph({
    integrations: [
      {
        id: "integration-1",
        integration: { id: "integration-1", name: "ServiceNow" },
        application: { name: "ServiceNow" },
      },
    ],
    savedGroups: [
      {
        id: "group:external",
        title: "Sistemas externos",
        description: "Integrações corporativas",
      },
    ],
    savedNodes: [
      {
        id: "group:external",
        position: { x: 100, y: 100 },
      },
      {
        id: "integration:integration-1",
        parentId: "group:external",
        position: { x: 20, y: 90 },
      },
    ],
  });

  assert.equal(graph.nodes[0].type, "topologyGroup");
  assert.equal(graph.nodes[1].parentId, "group:external");
  assert.equal(graph.nodes[1].extent, "parent");
});

test("topology graph restores generic elements as groupable nodes", () => {
  const graph = buildTopologyGraph({
    savedElements: [
      {
        id: "element:gateway",
        type: "Gateway",
        title: "Gateway",
        description: "Fronteira externa",
        headerColor: "#123456",
      },
    ],
    savedGroups: [{ id: "group:edge", title: "Borda" }],
    savedNodes: [
      { id: "group:edge", position: { x: 0, y: 0 } },
      {
        id: "element:gateway",
        parentId: "group:edge",
        position: { x: 20, y: 90 },
      },
    ],
  });

  assert.equal(graph.nodes[1].type, "topologyElement");
  assert.equal(graph.nodes[1].parentId, "group:edge");
  assert.equal(graph.nodes[1].data.element.title, "Gateway");
  assert.equal(graph.nodes[1].data.element.type, "Gateway");
});

test("topology groups shrink after children are removed", () => {
  const nodes = resizeTopologyGroups([
    {
      id: "group:large",
      type: "topologyGroup",
      position: { x: 0, y: 0 },
      style: { width: 900, height: 900 },
      data: { group: { title: "Grande" } },
    },
    {
      id: "element:1",
      type: "topologyElement",
      parentId: "group:large",
      position: { x: 20, y: 90 },
      data: { element: { title: "Elemento" } },
    },
    {
      id: "element:2",
      type: "topologyElement",
      parentId: "group:large",
      position: { x: 620, y: 640 },
      data: { element: { title: "Elemento distante" } },
    },
  ]);

  assert.deepEqual(nodes[0].style, { width: 940, height: 900 });
  assert.deepEqual(
    resizeTopologyGroups(nodes.filter(({ id }) => id !== "element:2"))[0].style,
    { width: 640, height: 380 },
  );
});

test("topology graph restores positions and discards dangling edges", () => {
  const graph = buildTopologyGraph({
    components: [{ id: "component-api", name: "API" }],
    deployments: [{ id: "deployment-api", componentId: "component-api" }],
    runtimes: [
      {
        id: "runtime-api",
        deploymentId: "deployment-api",
        serverId: "server-1",
        name: "API 1",
        kind: "container",
      },
    ],
    servers: [{ id: "server-1", name: "Produção 1" }],
    savedNodes: [{ id: "server:server-1", position: { x: 120, y: 240 } }],
    savedEdges: [
      {
        id: "dangling",
        source: "server:server-1",
        target: "server:missing",
        connectionType: "api",
      },
    ],
  });

  assert.deepEqual(graph.nodes[0].position, { x: 120, y: 240 });
  assert.deepEqual(graph.edges, []);
});

test("topology graph visibility filters integrations without losing local components", () => {
  const nodes = [
    {
      id: "server:shared",
      data: {
        managed: false,
        components: [
          { id: "local", integrated: false },
          {
            id: "integrated",
            integrated: true,
            integrationId: "integration-1",
          },
        ],
      },
    },
    {
      id: "runtime:external",
      data: {
        managed: true,
        components: [
          {
            id: "external",
            integrated: true,
            integrationId: "integration-1",
          },
        ],
      },
    },
  ];
  const edges = [
    {
      id: "edge-1",
      source: "server:shared",
      target: "runtime:external",
    },
  ];

  const graph = filterTopologyGraph({
    nodes,
    edges,
    hiddenIntegrationIds: ["integration-1"],
  });

  assert.deepEqual(
    graph.nodes.map(({ id }) => id),
    ["server:shared"],
  );
  assert.deepEqual(
    graph.nodes[0].data.components.map(({ id }) => id),
    ["local"],
  );
  assert.deepEqual(graph.edges, []);
  assert.equal(nodes[0].data.components.length, 2);
});

test("topology graph visibility filters physical servers and keeps managed runtimes", () => {
  const graph = filterTopologyGraph({
    nodes: [
      {
        id: "server:1",
        data: {
          server: { id: "server-1" },
          managed: false,
          components: [{ id: "local", integrated: false }],
        },
      },
      {
        id: "runtime:1",
        data: {
          managed: true,
          components: [{ id: "managed", integrated: false }],
        },
      },
    ],
    edges: [{ id: "edge-1", source: "server:1", target: "runtime:1" }],
    hiddenServerIds: ["server-1"],
  });

  assert.deepEqual(
    graph.nodes.map(({ id }) => id),
    ["runtime:1"],
  );
  assert.deepEqual(graph.edges, []);
});

test("topology graph visibility independently filters integration nodes", () => {
  const nodes = [
    {
      id: "integration:1",
      type: "topologyIntegration",
      data: {
        integration: { id: "1" },
        application: { name: "ServiceNow" },
      },
    },
    {
      id: "integration:2",
      type: "topologyIntegration",
      data: {
        integration: { id: "2" },
        application: { name: "WFM" },
      },
    },
    {
      id: "runtime:1",
      type: "topologyServer",
      data: {
        managed: true,
        components: [{ id: "local", integrated: false }],
      },
    },
    {
      id: "server:1",
      type: "topologyServer",
      data: {
        server: { id: "server-1" },
        managed: false,
        components: [{ id: "server-component", integrated: false }],
      },
    },
  ];

  const withoutIntegrations = filterTopologyGraph({
    nodes,
    hiddenIntegrationIds: ["1"],
  });
  assert.deepEqual(
    withoutIntegrations.nodes.map(({ id }) => id),
    ["integration:2", "runtime:1", "server:1"],
  );

  const withoutServers = filterTopologyGraph({
    nodes,
    hiddenServerIds: ["server-1"],
  });
  assert.deepEqual(
    withoutServers.nodes.map(({ id }) => id),
    ["integration:1", "integration:2", "runtime:1"],
  );
});

test("topology diagram payload stores only editable graph state", () => {
  const payload = topologyDiagramPayload({
    name: " Produção ",
    environment: "production",
    comments: "Observação",
    hiddenIntegrationIds: ["integration-1"],
    hiddenServerIds: ["server-1"],
    nodes: [
      {
        id: "group:core",
        type: "topologyGroup",
        position: { x: 0, y: 0 },
        data: {
          group: {
            id: "group:core",
            title: "Núcleo",
            description: "Serviços centrais",
          },
        },
      },
      {
        id: "server:1",
        parentId: "group:core",
        position: { x: 10, y: 20 },
        data: { transient: true },
      },
      {
        id: "element:gateway",
        type: "topologyElement",
        position: { x: 700, y: 20 },
        data: {
          element: {
            id: "element:gateway",
            type: "Gateway",
            title: "Gateway",
            description: "Fronteira externa",
            headerColor: "#123456",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "server:1",
        target: "server:2",
        sourceHandle: "bottom-right",
        targetHandle: "top-left",
        type: "step",
        label: "API / HTTP",
        data: {
          connectionType: "api",
          direction: "both",
          customLabel: "REST",
        },
      },
    ],
  });

  assert.equal(payload.name, "Produção");
  assert.deepEqual(payload.hiddenIntegrationIds, ["integration-1"]);
  assert.deepEqual(payload.hiddenServerIds, ["server-1"]);
  assert.deepEqual(payload.groups, [
    {
      id: "group:core",
      title: "Núcleo",
      description: "Serviços centrais",
    },
  ]);
  assert.deepEqual(payload.elements, [
    {
      id: "element:gateway",
      type: "Gateway",
      title: "Gateway",
      description: "Fronteira externa",
      headerColor: "#123456",
    },
  ]);
  assert.deepEqual(payload.nodes, [
    {
      id: "group:core",
      position: { x: 0, y: 0 },
    },
    {
      id: "server:1",
      parentId: "group:core",
      position: { x: 10, y: 20 },
    },
    {
      id: "element:gateway",
      position: { x: 700, y: 20 },
    },
  ]);
  assert.equal(payload.edges[0].connectionType, "api");
  assert.equal(payload.edges[0].direction, "both");
  assert.equal(payload.edges[0].sourceHandle, "bottom-right");
  assert.equal(payload.edges[0].targetHandle, "top-left");
  assert.equal(payload.edges[0].lineType, "step");
  assert.equal(payload.edges[0].label, "REST");
});
