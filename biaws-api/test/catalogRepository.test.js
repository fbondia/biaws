import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationDeletionDependencies,
  buildApplicationFilter,
  buildOperationalWorkspaceFilter,
  normalizeApplicationInput,
} from "../src/repositories/catalogRepository.js";
import { PERMISSION_CATALOG } from "../../shared/index.js";

test("catalog permissions are part of the canonical catalog", () => {
  const permissions = new Set(PERMISSION_CATALOG.map(({ id }) => id));
  for (const permission of [
    "workspaces.read",
    "workspaces.manage",
    "applications.read",
    "applications.create",
    "applications.update",
    "applications.archive",
  ]) {
    assert.equal(permissions.has(permission), true, permission);
  }
});

test("normalizes an application payload without persisting derived names", () => {
  assert.deepEqual(
    normalizeApplicationInput({
      key: "billing-api",
      name: " Billing API ",
      description: " Serviço de faturamento ",
      owner: { team: " Plataforma ", contact: "platform@example.test " },
      tags: ["Backend", "backend", "Critical"],
      links: [{ label: "Repository", url: "https://example.test/billing" }],
    }),
    {
      key: "billing-api",
      name: "Billing API",
      description: "Serviço de faturamento",
      owner: { team: "Plataforma", contact: "platform@example.test" },
      tags: ["Backend", "Critical"],
      links: [{ label: "Repository", url: "https://example.test/billing" }],
    },
  );
});

test("rejects invalid application identifiers and accepts identifier changes", () => {
  assert.throws(
    () => normalizeApplicationInput({ key: "Billing API", name: "Billing" }),
    (error) => error.code === "INVALID_CATALOG_KEY" && error.statusCode === 422,
  );
  assert.equal(
    normalizeApplicationInput(
      { key: "new-key" },
      {
        key: "old-key",
        name: "Old",
        description: "",
        owner: {},
        tags: [],
        links: [],
      },
    ).key,
    "new-key",
  );
});

test("rejects links with embedded credentials and unknown fields", () => {
  assert.throws(
    () =>
      normalizeApplicationInput({
        key: "billing",
        name: "Billing",
        links: [
          { label: "Private", url: "https://user:secret@example.test/repo" },
        ],
      }),
    (error) => error.code === "INVALID_CATALOG_URL",
  );
  assert.throws(
    () =>
      normalizeApplicationInput({
        key: "billing",
        name: "Billing",
        workspaceId: "forged",
      }),
    (error) => error.code === "INVALID_CATALOG_PAYLOAD",
  );
});

test("application filters are workspace-bound and escape search expressions", () => {
  const filter = buildApplicationFilter("workspace-1", { q: "api.*" });
  assert.equal(filter.workspaceId, "workspace-1");
  assert.equal(filter.status, "active");
  assert.equal(filter.$or[0].key.test("api.*"), true);
  assert.equal(filter.$or[0].key.test("api-anything"), false);

  assert.deepEqual(
    buildApplicationFilter("workspace-1", { includeArchived: "true" }),
    { workspaceId: "workspace-1" },
  );
});

test("application filters support assigned and root collections", () => {
  assert.equal(
    buildApplicationFilter("workspace-1", { collectionId: "collection-1" })
      .collectionId,
    "collection-1",
  );
  assert.deepEqual(
    buildApplicationFilter("workspace-1", { collectionId: "" }).collectionId,
    { $in: ["", null] },
  );
});

test("permanent application deletion checks every owned and referenced resource", () => {
  const dependencies = applicationDeletionDependencies({
    id: "application-1",
    workspaceId: "workspace-1",
  });
  assert.deepEqual(
    dependencies.map(([label]) => label),
    [
      "componentes",
      "integrações",
      "repositórios",
      "deployments",
      "runtimes",
      "documentos",
      "issues",
      "demandas",
      "segredos",
    ],
  );
  assert.deepEqual(dependencies[1][2], {
    workspaceId: "workspace-1",
    $or: [
      { applicationId: "application-1" },
      { targetApplicationId: "application-1" },
    ],
  });
  for (const [, , filter] of dependencies.filter(
    ([label]) => label !== "integrações",
  )) {
    assert.equal(filter.workspaceId, "workspace-1");
    assert.equal(filter.applicationId, "application-1");
  }
});

test("workspace filters use the explicit workspace boundary", () => {
  assert.deepEqual(buildOperationalWorkspaceFilter("workspace-1"), {
    id: "workspace-1",
  });
});
