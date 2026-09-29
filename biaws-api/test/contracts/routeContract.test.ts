import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { accessRouter } from "../../src/routes/access/index.js";
import { auditRouter } from "../../src/routes/audit/index.js";
import { catalogRouter } from "../../src/routes/catalog/index.js";
import { catalogTopologyRouter } from "../../src/routes/catalogTopology/index.js";
import { homeRouter } from "../../src/routes/home/index.js";
import { identityRouter } from "../../src/routes/identity/index.js";
import { issuesRouter } from "../../src/routes/issues/index.js";
import { knowledgeRecordsRouter } from "../../src/routes/knowledgeRecords/index.js";
import { monitoringRouter } from "../../src/routes/monitoring/index.js";
import { optionListsRouter } from "../../src/routes/optionLists/index.js";
import { platformRouter } from "../../src/routes/platform/index.js";
import { requestsRouter } from "../../src/routes/requests/index.js";
import { resourceCollectionsRouter } from "../../src/routes/resourceCollections/index.js";
import { secretsRouter } from "../../src/routes/secrets/index.js";
import { skillsRouter } from "../../src/routes/skills/index.js";
import { userPreferencesRouter } from "../../src/routes/userPreferences/index.js";

const routers = {
  accessRouter,
  auditRouter,
  catalogRouter,
  catalogTopologyRouter,
  homeRouter,
  identityRouter,
  issuesRouter,
  knowledgeRecordsRouter,
  monitoringRouter,
  optionListsRouter,
  platformRouter,
  requestsRouter,
  resourceCollectionsRouter,
  secretsRouter,
  skillsRouter,
  userPreferencesRouter,
};

test("API routers preserve endpoint methods, paths, middleware and precedence", async () => {
  const expected = JSON.parse(
    await readFile(
      new URL("../fixtures/api-route-contract.json", import.meta.url),
      "utf8",
    ),
  );
  const actual = Object.fromEntries(
    Object.entries(routers).map(([name, router]) => [
      name,
      router.stack.map((layer) =>
        layer.route
          ? {
              path: layer.route.path,
              methods: Object.keys(
                (
                  layer.route as typeof layer.route & {
                    methods: Record<string, boolean>;
                  }
                ).methods,
              ),
              handlers: layer.route.stack.length,
            }
          : { middleware: layer.name },
      ),
    ]),
  );
  assert.deepEqual(actual, expected);
});
