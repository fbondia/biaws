import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { withHttpClient } from "./monitoringTools.fixtures.js";
test(
  "monitoring read and evaluation tools dispatch to scoped API endpoints",
  withHttpClient(async (calls) => {
    const cases = [
      [
        "monitoring_templates_list",
        { status: "active", limit: 20 },
        "/api/monitoring/templates?status=active&limit=20",
      ],
      [
        "monitoring_templates_get",
        { templateId: "health/api", version: "2" },
        "/api/monitoring/templates/health%2Fapi?version=2",
      ],
      [
        "monitoring_templates_get_usage",
        { templateId: "health", version: "2" },
        "/api/monitoring/templates/health/versions/2/usage",
      ],
      [
        "monitoring_templates_get_contract",
        { templateId: "health", version: "2" },
        "/api/monitoring/templates/health/versions/2/contract",
      ],
      [
        "runtime_monitoring_results_list",
        {
          runtimeReference: "runtime/key",
          observedFrom: "2026-08-19T10:00:00-03:00",
          observedTo: "2026-08-19T12:30:00-03:00",
          status: "degraded",
          page: 2,
          limit: 10,
        },
        "/api/monitoring/runtimes/runtime%2Fkey/timeline?observedFrom=2026-08-19T10%3A00%3A00-03%3A00&observedTo=2026-08-19T12%3A30%3A00-03%3A00&status=degraded&page=2&limit=10",
      ],
      [
        "runtime_monitoring_health_summary",
        {
          runtimeReference: "runtime/key",
          observedFrom: "2026-01-01",
          observedTo: "2026-06-30",
          resolution: "auto",
          maxPoints: 400,
        },
        "/api/monitoring/runtimes/runtime%2Fkey/health-summary?observedFrom=2026-01-01&observedTo=2026-06-30&resolution=auto&maxPoints=400",
      ],
      [
        "runtime_active_monitors_list",
        { runtimeReference: "runtime/key", page: 2, limit: 10 },
        "/api/monitoring/runtimes/runtime%2Fkey/active-monitors?page=2&limit=10",
      ],
    ] as const;
    for (const [name, args] of cases) await dispatchTool(name, args);
    assert.deepEqual(
      calls.map(({ url }) => new URL(url).pathname + new URL(url).search),
      cases.map(([, , path]) => path),
    );
    assert.equal(
      calls.every(({ options }) => !options.method),
      true,
    );
    assert.equal(
      calls.every(
        ({ options }) =>
          new Headers(options.headers).get("X-Biaws-Workspace-Id") ===
          "workspace-1",
      ),
      true,
    );
  }),
);
