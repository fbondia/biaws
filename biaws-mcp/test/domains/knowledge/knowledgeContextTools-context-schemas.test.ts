import assert from "node:assert/strict";
import test from "node:test";
import { listTools } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
test("issue and demand creation schemas require applicationId", () => {
  const byName = new Map(listTools().map((tool) => [tool.name, tool]));
  for (const name of ["issues_create", "issues_import_eml", "demands_create"] as const) {
    assert.equal(required(required(byName.get(name)).inputSchema.required).includes("applicationId"), true, name);
  }
  assert.deepEqual(required(byName.get("issues_analyze_eml_file")).inputSchema.required, ["filePath"]);
  assert.deepEqual(required(byName.get("issues_import_eml_file")).inputSchema.required, [
    "filePath",
    "expectedSha256",
    "applicationId",
  ]);
  for (const name of ["documents_create", "documents_update"] as const) {
    assert.equal(required(required(byName.get(name)).inputSchema.required).includes("applicationId"), false, name);
    assert.ok(required(byName.get(name)).inputSchema.properties.affectedComponentIds);
  }
});

test("improvement tools expose the journey model", () => {
  const byName = new Map(listTools().map((tool) => [tool.name, tool]));
  const create = byName.get("demands_create");
  const journeyItems = required(required(create).inputSchema.properties.journeys.items).properties;

  assert.ok(byName.has("demands_journey_calendar"));
  assert.equal(byName.has("demands_billing_calendar"), false);
  assert.ok(required(journeyItems).plannedJourneys);
  assert.ok(required(journeyItems).executedJourneys);
  assert.equal(Object.hasOwn(required(journeyItems), "billedJourneys"), false);
  assert.equal(Object.hasOwn(required(create).inputSchema.properties, "billing"), false);
});
