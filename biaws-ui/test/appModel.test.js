import assert from "node:assert/strict";
import test from "node:test";

import { APP_VIEWS, SETTINGS_VIEWS } from "../src/App/model.js";

test("applications and servers are grouped under settings", () => {
  assert.equal(
    APP_VIEWS.some(({ key }) => key === "catalog"),
    false,
  );
  assert.equal(
    APP_VIEWS.some(({ key }) => key === "servers"),
    false,
  );
  assert.deepEqual(
    SETTINGS_VIEWS.slice(0, 2).map(({ key }) => key),
    ["catalog", "servers"],
  );
});
