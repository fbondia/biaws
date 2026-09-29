import assert from "node:assert/strict";
import test from "node:test";
import { catalogTools } from "../../../src/domains/catalog/tools.js";
import { listTools } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
test("catalog tools are registered once with explicit bounded schemas", () => {
  const expected = [
    "applications_list",

    "applications_get_context",
    "components_list",

    "integrations_list",

    "repositories_list",

    "servers_list",

    "deployments_list",

    "runtimes_list",

    "applications_create",
    "applications_update",
    "components_create",
    "components_update",
    "integrations_create",
    "integrations_update",
    "repositories_create",
    "repositories_update",
    "servers_create",
    "servers_update",
    "deployments_create",
    "deployments_update",
    "deployments_record_publication",
    "runtimes_create",
    "runtimes_update",
  ];
  assert.deepEqual(
    catalogTools.map(({ name }) => name),
    expected,
  );
  const registered = listTools();
  assert.equal(new Set(registered.map(({ name }) => name)).size, registered.length);
  for (const tool of catalogTools) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.equal(
      registered.some(({ name }) => name === tool.name),
      true,
      tool.name,
    );
  }
  assert.equal(
    required(catalogTools.find(({ name }) => name === "applications_get_context")).inputSchema.properties.limit.maximum,
    100,
  );
  for (const name of [
    "applications_update",
    "components_update",
    "integrations_update",
    "repositories_update",
    "servers_update",
    "deployments_update",
    "runtimes_update",
  ] as const) {
    assert.equal(
      Object.hasOwn(required(catalogTools.find((tool) => tool.name === name)).inputSchema.properties, "key"),
      true,
      name,
    );
  }
  assert.equal(
    Object.hasOwn(
      required(catalogTools.find((tool) => tool.name === "deployments_update")).inputSchema.properties,
      "componentId",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(
      required(catalogTools.find((tool) => tool.name === "integrations_update")).inputSchema.properties,
      "targetApplicationId",
    ),
    false,
  );
  const publicationStatus = required(
    required(
      required(catalogTools.find(({ name }) => name === "deployments_update")).inputSchema.properties.publications
        .items,
    ).properties,
  ).status;
  assert.deepEqual(publicationStatus.enum, ["planned", "canceled", "deployed"]);
  const recordPublicationProperties = required(
    catalogTools.find(({ name }) => name === "deployments_record_publication"),
  ).inputSchema.properties;
  assert.equal(Object.hasOwn(recordPublicationProperties, "publications"), false);
  assert.equal(Object.hasOwn(recordPublicationProperties, "recordedAt"), false);
  assert.equal(Object.hasOwn(recordPublicationProperties, "recordedBy"), false);
  const runtimeProperties = required(catalogTools.find(({ name }) => name === "runtimes_update")).inputSchema
    .properties;
  assert.equal(runtimeProperties.monitoringRetentionDays.default, undefined);
  assert.equal(runtimeProperties.monitoringRetentionDays.maximum, 3650);
  assert.equal(runtimeProperties.documentLinks.maxItems, 100);
  assert.equal(required(required(runtimeProperties.documentLinks.items).properties).documentId.type, "string");
  assert.equal(Object.hasOwn(runtimeProperties, "observations"), false);
});

test("catalog schemas expose no credential or remote execution argument", () => {
  const prohibited = new Set([
    "password",
    "secret",
    "token",
    "credential",
    "privateKey",
    "kubeconfig",
    "connectionString",
    "command",
    "shell",
    "ssh",
    "mongoQuery",
  ]);
  function visit(schema: import("../../../src/mcp/tools/contracts.js").Schema): void {
    for (const [key, value] of Object.entries(schema?.properties || {})) {
      assert.equal(prohibited.has(key), false, key);
      visit(value);
      if (value.items) visit(value.items);
    }
  }
  catalogTools.forEach(({ inputSchema }) => visit(inputSchema));
});
