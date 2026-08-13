import assert from "node:assert/strict";
import test from "node:test";

import { visibleCatalogTabs } from "../src/components/catalog/CatalogView/model.js";

test("catalog tabs expose topology with either supported read permission", () => {
  const componentReader = visibleCatalogTabs({
    permissions: ["applications.read", "components.read"],
  });
  const deploymentReader = visibleCatalogTabs({
    permissions: ["deployments.read"],
  });

  assert.deepEqual(
    componentReader.map(({ key }) => key),
    ["overview", "topology", "history"],
  );
  assert.deepEqual(
    deploymentReader.map(({ key }) => key),
    ["topology"],
  );
});

test("catalog tabs omit domains without matching permissions", () => {
  assert.deepEqual(visibleCatalogTabs({ permissions: [] }), []);
  assert.deepEqual(
    visibleCatalogTabs({ permissions: ["repositories.read"] }).map(
      ({ key }) => key,
    ),
    ["repositories"],
  );
});
