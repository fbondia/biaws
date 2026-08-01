import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogEntityDraft,
  catalogEntityPayload,
  monitoringSignalCurl,
  runtimeMonitoringPath,
} from "../src/components/catalog/catalogModel.js";

test("catalog payload includes editable identifiers on updates", () => {
  const payload = catalogEntityPayload(
    "deployment",
    catalogEntityDraft("deployment", {
      key: "prod",
      name: "Produção",
      componentId: "component-1",
    }),
    true,
  );
  assert.equal(payload.key, "prod");
  assert.equal(Object.hasOwn(payload, "componentId"), false);
});

test("deployment payload stores repository and publication history", () => {
  const draft = catalogEntityDraft("deployment", {
    key: "prod",
    name: "Produção",
    componentId: "component-1",
    repositoryId: "repository-1",
    publications: [
      {
        id: "publication-1",
        version: "2.4.0",
        revision: "abc123",
        publishedAt: "2026-07-30T12:00:00.000Z",
        description: "Publicação principal",
      },
    ],
  });
  const payload = catalogEntityPayload("deployment", draft, true);
  assert.equal(payload.repositoryId, "repository-1");
  assert.equal(payload.publications[0].version, "2.4.0");
  assert.equal(Object.hasOwn(payload, "version"), false);
  assert.equal(Object.hasOwn(payload, "deployedAt"), false);
});

test("integration payload preserves the target only when creating", () => {
  const draft = catalogEntityDraft("integration", {
    key: "customer-api",
    name: "Customer API",
    description: "Consulta clientes",
    targetApplicationId: "application-2",
  });
  assert.deepEqual(catalogEntityPayload("integration", draft), {
    key: "customer-api",
    name: "Customer API",
    description: "Consulta clientes",
    targetApplicationId: "application-2",
  });
  const update = catalogEntityPayload("integration", draft, true);
  assert.equal(update.key, "customer-api");
  assert.equal(Object.hasOwn(update, "targetApplicationId"), false);
});

test("runtime monitoring references use contextual identifiers", () => {
  const runtimeReference = runtimeMonitoringPath({
    application: { key: "billing" },
    component: { key: "api" },
    deployment: { key: "production" },
    runtime: { key: "primary" },
  });
  assert.equal(runtimeReference, "billing.api.production.primary");
  assert.match(
    monitoringSignalCurl({
      apiUrl: `https://biaws.example.test/api/monitoring/runtimes/${runtimeReference}/signals`,
      runtimeReference,
      workspaceId: "workspace-1",
    }),
    /X-Biaws-Workspace-Id: workspace-1/u,
  );
});

test("catalog drafts accept an explicit null when creating", () => {
  assert.deepEqual(catalogEntityDraft("component", null), {
    key: "",
    name: "",
    description: "",
    type: "other",
    repositoryIds: [],
    dependencyIds: [],
    tagsText: "",
  });
});

test("runtime payload supports clearing server and validates metadata", () => {
  const draft = catalogEntityDraft("runtime", {
    key: "api-1",
    name: "API 1",
    serverId: "server-1",
    metadata: { image: "biaws:1" },
  });
  draft.serverId = "";
  const payload = catalogEntityPayload("runtime", draft, true);
  assert.equal(payload.serverId, null);
  assert.deepEqual(payload.metadata, { image: "biaws:1" });
  assert.deepEqual(payload.observations, []);
  assert.equal(payload.procedureMarkdown, "");

  draft.metadataText = "[1]";
  assert.throws(
    () => catalogEntityPayload("runtime", draft, true),
    /objeto JSON/u,
  );
});

test("application and component lists are normalized", () => {
  const application = catalogEntityPayload("application", {
    key: "billing",
    name: "Billing",
    ownerTeam: "Financeiro",
    ownerContact: "billing@example.test",
    tagsText: "core, finance",
  });
  assert.deepEqual(application.tags, ["core", "finance"]);
  assert.deepEqual(application.owner, {
    team: "Financeiro",
    contact: "billing@example.test",
  });

  const component = catalogEntityPayload("component", {
    key: "api",
    name: "API",
    type: "api",
    repositoryIds: ["repository-1"],
    dependencyIds: ["component-2"],
  });
  assert.equal(component.repositoryLinks[0].role, "source");
  assert.equal(component.dependencies[0].kind, "runtime");
});
