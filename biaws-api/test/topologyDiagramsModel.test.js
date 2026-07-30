import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDiagramEdges,
  normalizeDiagramElements,
  normalizeDiagramGroups,
  normalizeDiagramNodes,
  normalizeDiagramPayload,
  normalizeDiagramVisibilityIds,
} from "../src/repositories/topologyDiagramsRepository.js";

test("topology diagrams normalize node positions and typed edges", () => {
  const nodes = normalizeDiagramNodes([
    { id: "server:1", position: { x: 10, y: 20 } },
    { id: "server:2", position: { x: 30, y: 40 } },
  ]);
  const edges = normalizeDiagramEdges(
    [
      {
        id: "edge-1",
        source: "server:1",
        target: "server:2",
        sourceHandle: "bottom-right",
        targetHandle: "top-left",
        connectionType: "api",
        direction: "both",
        lineType: "step",
        label: "REST",
      },
    ],
    new Set(nodes.map(({ id }) => id)),
  );

  assert.deepEqual(edges, [
    {
      id: "edge-1",
      source: "server:1",
      target: "server:2",
      sourceHandle: "bottom-right",
      targetHandle: "top-left",
      connectionType: "api",
      direction: "both",
      lineType: "step",
      label: "REST",
    },
  ]);
});

test("topology diagrams default old edges and reject invalid connection settings", () => {
  const nodeIds = new Set(["server:1", "server:2"]);
  assert.deepEqual(
    normalizeDiagramEdges(
      [{ id: "edge-1", source: "server:1", target: "server:2" }],
      nodeIds,
    )[0],
    {
      id: "edge-1",
      source: "server:1",
      target: "server:2",
      sourceHandle: "",
      targetHandle: "",
      connectionType: "dependency",
      direction: "forward",
      lineType: "default",
      label: "",
    },
  );
  assert.throws(
    () =>
      normalizeDiagramEdges(
        [
          {
            id: "edge-2",
            source: "server:1",
            target: "server:2",
            direction: "sideways",
          },
        ],
        nodeIds,
      ),
    /direction must be one of/u,
  );
  assert.throws(
    () =>
      normalizeDiagramEdges(
        [
          {
            id: "edge-3",
            source: "server:1",
            target: "server:2",
            sourceHandle: "center",
          },
        ],
        nodeIds,
      ),
    /sourceHandle must be one of/u,
  );
  assert.throws(
    () =>
      normalizeDiagramEdges(
        [
          {
            id: "edge-4",
            source: "server:1",
            target: "server:2",
            lineType: "zigzag",
          },
        ],
        nodeIds,
      ),
    /lineType must be one of/u,
  );
});

test("topology diagrams reject dangling and self-referencing edges", () => {
  const nodeIds = new Set(["server:1", "server:2"]);
  assert.throws(
    () =>
      normalizeDiagramEdges(
        [
          {
            id: "edge-1",
            source: "server:1",
            target: "server:missing",
          },
        ],
        nodeIds,
      ),
    /must reference nodes/u,
  );
  assert.throws(
    () =>
      normalizeDiagramEdges(
        [
          {
            id: "edge-2",
            source: "server:1",
            target: "server:1",
          },
        ],
        nodeIds,
      ),
    /cannot connect a node to itself/u,
  );
});

test("topology diagrams normalize unique visibility ids", () => {
  assert.deepEqual(
    normalizeDiagramVisibilityIds(
      ["integration-1", "integration-2"],
      [],
      "hiddenIntegrationIds",
    ),
    ["integration-1", "integration-2"],
  );
  assert.throws(
    () =>
      normalizeDiagramVisibilityIds(
        ["server-1", "server-1"],
        [],
        "hiddenServerIds",
      ),
    /contains a repeated id/u,
  );
});

test("topology diagrams normalize groups and parent associations", () => {
  assert.deepEqual(
    normalizeDiagramGroups([
      {
        id: "group:core",
        title: "Núcleo",
        description: "Serviços centrais",
      },
    ]),
    [
      {
        id: "group:core",
        title: "Núcleo",
        description: "Serviços centrais",
      },
    ],
  );
  assert.deepEqual(
    normalizeDiagramNodes([
      {
        id: "server:1",
        parentId: "group:core",
        position: { x: 20, y: 80 },
      },
    ]),
    [
      {
        id: "server:1",
        parentId: "group:core",
        position: { x: 20, y: 80 },
      },
    ],
  );
});

test("topology diagrams require parent nodes to reference declared groups", () => {
  const payload = normalizeDiagramPayload({
    name: "Produção",
    nodes: [
      { id: "group:core", position: { x: 0, y: 0 } },
      {
        id: "server:1",
        parentId: "group:core",
        position: { x: 20, y: 80 },
      },
    ],
    groups: [{ id: "group:core", title: "Núcleo" }],
    edges: [],
  });
  assert.equal(payload.nodes[1].parentId, "group:core");

  assert.throws(
    () =>
      normalizeDiagramPayload({
        name: "Inválido",
        nodes: [
          {
            id: "server:1",
            parentId: "group:missing",
            position: { x: 20, y: 80 },
          },
        ],
        groups: [],
        edges: [],
      }),
    /node parent must reference a group/u,
  );
});

test("topology diagrams normalize generic elements", () => {
  assert.deepEqual(
    normalizeDiagramElements([
      {
        id: "element:gateway",
        type: "Gateway",
        title: "Gateway externo",
        description: "Fronteira de rede",
        headerColor: "#123456",
      },
    ]),
    [
      {
        id: "element:gateway",
        type: "Gateway",
        title: "Gateway externo",
        description: "Fronteira de rede",
        headerColor: "#123456",
      },
    ],
  );
  const payload = normalizeDiagramPayload({
    name: "Com elemento",
    nodes: [{ id: "element:gateway", position: { x: 10, y: 20 } }],
    elements: [{ id: "element:gateway", title: "Gateway externo" }],
    edges: [],
  });
  assert.equal(payload.elements[0].title, "Gateway externo");
  assert.equal(payload.elements[0].type, "Elemento");
  assert.equal(payload.elements[0].headerColor, "#edf9f5");
  assert.throws(
    () =>
      normalizeDiagramElements([
        {
          id: "element:invalid",
          title: "Inválido",
          headerColor: "red",
        },
      ]),
    /must be a hexadecimal color/u,
  );
});
