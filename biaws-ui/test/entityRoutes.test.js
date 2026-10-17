import assert from "node:assert/strict";
import test from "node:test";
import { entityUrl, readRoute, viewUrl, VIEW_ENTITIES, VIEW_ROUTES } from "../src/navigation/model.js";
import { findEntity } from "../src/navigation/entities.js";

const routeAt = (url) => readRoute(new URL(url, "https://biaws.example.test"));

test("all entity views round-trip IDs, identifiers, encoding and workspace", () => {
  for (const [view, type] of Object.entries(VIEW_ENTITIES)) {
    for (const reference of ["507f1f77bcf86cd799439011", "INC-42", "código /?# %"]) {
      const url = entityUrl(type, reference, { view, selections: {}, workspaceId: "workspace-a" });
      assert.deepEqual(routeAt(url), {
        view,
        workspaceId: "workspace-a",
        selections: { [type]: reference },
        valid: true,
      });
    }
  }
  for (const view of Object.keys(VIEW_ROUTES)) assert.equal(routeAt(viewUrl(view)).view, view);
});

test("tasks retain the parent demand; catalog children retain the application", () => {
  const route = routeAt("/requests/MEL-42?workspaceId=workspace-b");
  assert.deepEqual(routeAt(entityUrl("task", "T-1", route)).selections, { demand: "MEL-42", task: "T-1" });
  assert.equal(entityUrl("task", null, route), "/requests/MEL-42?workspaceId=workspace-b");
  for (const type of ["component", "repository", "integration", "deployment", "runtime", "topology-diagram"]) {
    const child = entityUrl(type, { id: "child", applicationId: "app" }, routeAt("/catalog?workspaceId=w"));
    assert.deepEqual(routeAt(child).selections, { application: "app", [type]: "child" });
    assert.equal(entityUrl(type, null, routeAt(child)), "/catalog/app?workspaceId=w");
  }
  for (const type of ["taxonomy-node", "tag-group"]) {
    assert.equal(
      routeAt(entityUrl(type, "subject/a", routeAt("/taxonomy?workspaceId=w"))).selections[type],
      "subject/a",
    );
  }
});

test("invalid and unsupported paths fail closed instead of opening another record", () => {
  for (const path of [
    "/issues/a/b",
    "/requests/a/tasks",
    "/catalog/a/unknown/b",
    "/documents/%ZZ",
    "/account/a",
    "/unknown",
    `/issues/${"a".repeat(241)}`,
  ]) {
    assert.equal(routeAt(path).valid, false, path);
  }
});

test("authorized list lookups prefer both IDs and reject ambiguous identifiers", () => {
  const items = [
    { id: "a", _id: "mongo-a", identifier: "shared" },
    { id: "b", identifier: "SHARED" },
  ];
  assert.equal(findEntity(items, "mongo-a").id, "a");
  assert.equal(findEntity(items, "a").id, "a");
  assert.throws(() => findEntity(items, "shared"), /ambíguo/);
  assert.throws(() => findEntity(items, "outside-scope"), /sem acesso/);
});
