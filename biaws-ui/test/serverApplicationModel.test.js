import assert from "node:assert/strict";
import test from "node:test";

import { buildServerApplicationGroups } from "../src/components/catalog/ServersView/model.js";

test("server applications group components and count local topology references", () => {
  const groups = buildServerApplicationGroups({
    applications: [
      { id: "application-b", name: "Aplicação B" },
      { id: "application-a", name: "Aplicação A" },
    ],
    components: [
      { id: "component-api", name: "API" },
      { id: "component-worker", name: "Worker" },
    ],
    deployments: [
      {
        id: "deployment-api-production",
        applicationId: "application-a",
        componentId: "component-api",
        environment: "production",
      },
      {
        id: "deployment-api-staging",
        applicationId: "application-a",
        componentId: "component-api",
        environment: "staging",
      },
      {
        id: "deployment-worker",
        applicationId: "application-b",
        componentId: "component-worker",
        environment: "production",
      },
    ],
    runtimes: [
      { id: "runtime-1", deploymentId: "deployment-api-production" },
      { id: "runtime-2", deploymentId: "deployment-api-production" },
      { id: "runtime-3", deploymentId: "deployment-api-staging" },
      { id: "runtime-4", deploymentId: "deployment-worker" },
    ],
  });

  assert.deepEqual(
    groups.map(({ name }) => name),
    ["Aplicação A", "Aplicação B"],
  );
  assert.deepEqual(groups[0].components, [
    {
      id: "component-api",
      name: "API",
      environments: ["production", "staging"],
      deploymentCount: 2,
      runtimeCount: 3,
    },
  ]);
});
