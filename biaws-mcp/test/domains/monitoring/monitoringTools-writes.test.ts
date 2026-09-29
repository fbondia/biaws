import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { withHttpClient } from "./monitoringTools.fixtures.js";
test(
  "template mutation tools preserve methods, identifiers and JSON samples",
  withHttpClient(async (calls) => {
    const definition = {
      schemaVersion: "1",
      input: { mediaType: "application/json", sample: [] },
    };
    const cases = [
      [
        "monitoring_templates_preview",
        { definition, sample: [1, 2] },
        "POST",
        "/api/monitoring/templates/preview",
      ],
      [
        "monitoring_templates_create",
        { name: "Health", definition },
        "POST",
        "/api/monitoring/templates",
      ],
      [
        "monitoring_templates_create_version",
        { templateId: "health", description: "v2", definition },
        "PATCH",
        "/api/monitoring/templates/health",
      ],
      [
        "monitoring_templates_validate",
        { templateId: "health", version: "2", sample: [1, 2] },
        "POST",
        "/api/monitoring/templates/health/versions/2/validate",
      ],
      [
        "monitoring_templates_activate",
        { templateId: "health", version: "2" },
        "POST",
        "/api/monitoring/templates/health/versions/2/activate",
      ],
      [
        "monitoring_templates_deactivate",
        { templateId: "health", version: "2" },
        "POST",
        "/api/monitoring/templates/health/versions/2/deactivate",
      ],
      [
        "monitoring_templates_archive",
        { templateId: "unused", version: "1" },
        "DELETE",
        "/api/monitoring/templates/unused/versions/1",
      ],
    ] as const;
    for (const [name, args] of cases) await dispatchTool(name, args);
    calls.forEach((call, index) => {
      assert.equal(call.options.method, cases[index][2]);
      assert.equal(new URL(call.url).pathname, cases[index][3]);
      assert.equal(
        new Headers(call.options.headers).get("Authorization"),
        "Bearer biaws_test_key",
      );
    });
    assert.deepEqual(JSON.parse(String(calls[0].options.body)).sample, [1, 2]);
    assert.equal(
      Object.hasOwn(JSON.parse(String(calls[2].options.body)), "templateId"),
      false,
    );
    assert.deepEqual(JSON.parse(String(calls[3].options.body)), {
      sample: [1, 2],
    });
  }),
);
