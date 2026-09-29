import assert from "node:assert/strict";
import test from "node:test";
import { monitoringTools } from "../../../src/domains/monitoring/tools.js";
import { listTools } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
test("monitoring tools are registered once with closed top-level schemas", () => {
  const expected = [
    "applications_monitoring_health_get",
    "runtime_monitoring_signals_list",
    "monitoring_templates_list",

    "monitoring_templates_preview",
    "monitoring_templates_create",
    "monitoring_templates_create_version",

    "monitoring_templates_validate",
    "monitoring_templates_activate",
    "monitoring_templates_deactivate",
    "monitoring_templates_archive",
    "runtime_monitoring_results_list",
    "runtime_monitoring_health_summary",

    "runtime_active_monitors_create",
    "runtime_active_monitors_update",
    "runtime_active_monitors_archive",
  ];
  assert.deepEqual(
    monitoringTools.map(({ name }) => name),
    expected,
  );
  const registered = listTools();
  for (const tool of monitoringTools) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.equal(registered.filter(({ name }) => name === tool.name).length, 1, tool.name);
  }
  const createMonitor = required(monitoringTools.find(({ name }) => name === "runtime_active_monitors_create"));
  assert.deepEqual(createMonitor.inputSchema.properties.provider.enum, ["rest", "shell"]);
  assert.equal(createMonitor.inputSchema.properties.intervalSeconds.minimum, 10);
  assert.equal(createMonitor.inputSchema.properties.timeoutSeconds.maximum, 300);
});
