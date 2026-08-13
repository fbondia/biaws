import assert from "node:assert/strict";
import test from "node:test";

import {
  appendPublicationDraft,
  catalogEntityDraft,
  catalogEntityPayload,
  monitoringSignalCurl,
  runtimeMonitoringPath,
} from "../src/components/catalog/CatalogEntityDialog/model.js";

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
        status: "planned",
        publishedAt: "2026-07-30T12:00:00.000Z",
        description: "Publicação principal",
      },
    ],
  });
  const payload = catalogEntityPayload("deployment", draft, true);
  assert.equal(payload.repositoryId, "repository-1");
  assert.equal(payload.publications[0].version, "2.4.0");
  assert.equal(payload.publications[0].status, "planned");
  assert.equal(Object.hasOwn(payload, "version"), false);
  assert.equal(Object.hasOwn(payload, "deployedAt"), false);
});

test("deployment save includes a publication draft that was not added yet", () => {
  const draft = catalogEntityDraft("deployment", {
    key: "prod",
    name: "Produção",
    repositoryId: "repository-1",
    publications: [{ id: "publication-1", version: "2.3.0" }],
  });
  const draftToSave = appendPublicationDraft(
    draft,
    {
      version: " 2.4.0 ",
      revision: " abc123 ",
      status: "planned",
      publishedAt: "2026-08-13T09:30",
      description: " Publicação principal ",
    },
    {
      id: "draft-publication-2",
      publishedAt: "2026-08-13T12:30:00.000Z",
    },
  );

  const payload = catalogEntityPayload("deployment", draftToSave, true);
  assert.equal(payload.publications.length, 2);
  assert.deepEqual(payload.publications[1], {
    id: "draft-publication-2",
    version: "2.4.0",
    revision: "abc123",
    repositoryId: "repository-1",
    status: "planned",
    publishedAt: new Date("2026-08-13T09:30").toISOString(),
    description: "Publicação principal",
  });
});

test("empty publication draft is ignored when saving a deployment", () => {
  const draft = catalogEntityDraft("deployment", {
    key: "prod",
    name: "Produção",
  });

  assert.equal(
    appendPublicationDraft(draft, {
      version: "  ",
      revision: "abc123",
      status: "planned",
      publishedAt: "",
      description: "Ainda incompleta",
    }),
    draft,
  );
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
  assert.match(
    monitoringSignalCurl({
      apiUrl: `https://biaws.example.test/api/monitoring/runtimes/${runtimeReference}/signals`,
      runtimeReference,
      workspaceId: "workspace-1",
    }),
    /"payload":\{"probe":\{"statusCode":200/u,
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
  assert.equal(payload.monitoringRetentionDays, 10);
  assert.equal(Object.hasOwn(payload, "observations"), false);
  assert.deepEqual(payload.documentLinks, []);
  assert.equal(payload.operationalNotesMarkdown, "");

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
