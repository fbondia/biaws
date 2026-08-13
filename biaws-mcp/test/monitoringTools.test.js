import assert from "node:assert/strict";
import test from "node:test";

import { monitoringTools } from "../src/domains/monitoring/tools.js";
import { dispatchTool, listTools } from "../src/tools.js";

function jsonResponse(payload = { ok: true }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function withHttpClient(testFunction) {
  return async () => {
    const originalFetch = globalThis.fetch;
    const originalBaseUrl = process.env.ISSUE_API_URL;
    const originalApiKey = process.env.ISSUE_API_KEY;
    const originalWorkspaceId = process.env.ISSUE_WORKSPACE_ID;
    process.env.ISSUE_API_URL = "http://api.test";
    process.env.ISSUE_API_KEY = "biaws_test_key";
    process.env.ISSUE_WORKSPACE_ID = "workspace-1";
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return jsonResponse();
    };
    try {
      await testFunction(calls);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [name, value] of [
        ["ISSUE_API_URL", originalBaseUrl],
        ["ISSUE_API_KEY", originalApiKey],
        ["ISSUE_WORKSPACE_ID", originalWorkspaceId],
      ]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  };
}

test("monitoring tools are registered once with closed top-level schemas", () => {
  const expected = [
    "monitoring_templates_list",
    "monitoring_templates_get",
    "monitoring_templates_preview",
    "monitoring_templates_create",
    "monitoring_templates_create_version",
    "monitoring_templates_get_usage",
    "monitoring_templates_get_contract",
    "monitoring_templates_validate",
    "monitoring_templates_activate",
    "monitoring_templates_deactivate",
    "monitoring_templates_archive",
    "runtime_active_monitors_list",
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
    assert.equal(
      registered.filter(({ name }) => name === tool.name).length,
      1,
      tool.name,
    );
  }
  const createMonitor = monitoringTools.find(
    ({ name }) => name === "runtime_active_monitors_create",
  );
  assert.deepEqual(createMonitor.inputSchema.properties.provider.enum, [
    "rest",
    "shell",
  ]);
  assert.equal(
    createMonitor.inputSchema.properties.intervalSeconds.minimum,
    10,
  );
  assert.equal(
    createMonitor.inputSchema.properties.timeoutSeconds.maximum,
    300,
  );
});

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
        "runtime_active_monitors_list",
        { runtimeReference: "runtime/key", page: 2, limit: 10 },
        "/api/monitoring/runtimes/runtime%2Fkey/active-monitors?page=2&limit=10",
      ],
    ];
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
          options.headers["X-Biaws-Workspace-Id"] === "workspace-1",
      ),
      true,
    );
  }),
);

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
    ];
    for (const [name, args] of cases) await dispatchTool(name, args);
    calls.forEach((call, index) => {
      assert.equal(call.options.method, cases[index][2]);
      assert.equal(new URL(call.url).pathname, cases[index][3]);
      assert.equal(call.options.headers.Authorization, "Bearer biaws_test_key");
    });
    assert.deepEqual(JSON.parse(calls[0].options.body).sample, [1, 2]);
    assert.equal(
      Object.hasOwn(JSON.parse(calls[2].options.body), "templateId"),
      false,
    );
    assert.deepEqual(JSON.parse(calls[3].options.body), { sample: [1, 2] });
  }),
);

test(
  "active monitor tools use explicit runtime scope and omit path ids from payloads",
  withHttpClient(async (calls) => {
    await dispatchTool("runtime_active_monitors_create", {
      runtimeReference: "runtime-1",
      name: "Health REST",
      provider: "rest",
      enabled: false,
      intervalSeconds: 60,
      timeoutSeconds: 15,
      configuration: { method: "GET", url: "https://status.example.test" },
      templateRef: { id: "health", version: "2" },
    });
    await dispatchTool("runtime_active_monitors_update", {
      runtimeReference: "runtime-1",
      monitorId: "monitor/1",
      enabled: true,
    });
    await dispatchTool("runtime_active_monitors_archive", {
      runtimeReference: "runtime-1",
      monitorId: "monitor/1",
    });

    assert.deepEqual(
      calls.map(({ options }) => options.method),
      ["POST", "PATCH", "DELETE"],
    );
    assert.deepEqual(
      calls.map(({ url }) => new URL(url).pathname),
      [
        "/api/monitoring/runtimes/runtime-1/active-monitors",
        "/api/monitoring/runtimes/runtime-1/active-monitors/monitor%2F1",
        "/api/monitoring/runtimes/runtime-1/active-monitors/monitor%2F1",
      ],
    );
    const createPayload = JSON.parse(calls[0].options.body);
    assert.equal(Object.hasOwn(createPayload, "runtimeReference"), false);
    assert.equal(createPayload.enabled, false);
    assert.deepEqual(createPayload.templateRef, {
      id: "health",
      version: "2",
    });
    assert.deepEqual(JSON.parse(calls[1].options.body), { enabled: true });
  }),
);

test("monitoring schemas reject invalid enums, bounds and extra fields", async () => {
  for (const [name, args, path] of [
    [
      "runtime_active_monitors_create",
      {
        runtimeReference: "runtime-1",
        name: "Health",
        provider: "command",
        configuration: {},
      },
      "provider",
    ],
    [
      "runtime_active_monitors_create",
      {
        runtimeReference: "runtime-1",
        name: "Health",
        provider: "rest",
        intervalSeconds: 5,
        configuration: {},
      },
      "intervalSeconds",
    ],
    [
      "monitoring_templates_activate",
      { templateId: "health", version: "1", workspaceId: "other" },
      "workspaceId",
    ],
  ]) {
    await assert.rejects(
      () => dispatchTool(name, args),
      (error) =>
        error.code === "VALIDATION_ERROR" &&
        error.fields.some((field) => field.path === path),
    );
  }
});
