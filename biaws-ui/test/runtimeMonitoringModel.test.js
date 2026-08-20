import assert from "node:assert/strict";
import test from "node:test";

import {
  activeManualExecutionIds,
  activeMonitorDraft,
  activeMonitorPayload,
  mergeMonitoringEvents,
  monitoringCliExample,
  monitoringOriginLabel,
  newObservationDraft,
  selectableMonitoringTemplates,
} from "../src/components/monitoring/runtime/model.js";
import { monitoringFilterParams } from "../src/components/home/HomeView/constants.js";

test("active manual executions are collected from health metrics", () => {
  const ids = activeManualExecutionIds([
    {
      items: [
        {
          components: [
            {
              deployments: [
                {
                  runtimes: [
                    {
                      pendingExecutions: [
                        { id: "queued-1", status: "queued" },
                        { id: "running-1", status: "running" },
                      ],
                    },
                    { pendingExecutions: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]);

  assert.deepEqual([...ids], ["queued-1", "running-1"]);
});

test("REST monitor draft produces the provider contract without inline credentials", () => {
  const payload = activeMonitorPayload({
    ...activeMonitorDraft(),
    name: "Public health",
    intervalSeconds: "30",
    timeoutSeconds: "5",
    restUrl: "https://status.example.test/health",
    restHeadersText: '{"Accept":"application/json"}',
    restHeaderRefsText:
      '[{"name":"Authorization","reference":"secret:monitor-token"}]',
    restExpectedStatusesText: "200, 204, 200",
    templateId: "health-v1",
    templateVersion: "3",
  });

  assert.deepEqual(payload.configuration, {
    method: "GET",
    url: "https://status.example.test/health",
    headers: { Accept: "application/json" },
    headerRefs: [{ name: "Authorization", reference: "secret:monitor-token" }],
    body: "",
    followRedirects: false,
    expectedStatuses: [200, 204],
  });
  assert.deepEqual(payload.templateRef, { id: "health-v1", version: "3" });
});

test("shell monitor only accepts a script identifier and structured arguments", () => {
  const payload = activeMonitorPayload({
    ...activeMonitorDraft(),
    name: "Worker probe",
    provider: "shell",
    shellScriptId: "worker-health",
    shellArgumentsText: "--service\nworker",
    shellEnvironmentText: '{"CHECK_MODE":"read-only"}',
  });

  assert.deepEqual(payload.configuration, {
    scriptId: "worker-health",
    arguments: ["--service", "worker"],
    environment: { CHECK_MODE: "read-only" },
    failureStatus: "unavailable",
    captureOutput: "none",
  });
  assert.equal(payload.templateRef, null);
});

test("shell monitor removes a legacy template and exposes result controls", () => {
  const payload = activeMonitorPayload({
    ...activeMonitorDraft({
      id: "legacy-shell",
      name: "Legacy worker probe",
      provider: "shell",
      configuration: { scriptId: "worker-health" },
      templateRef: { id: "legacy-health", version: "1" },
    }),
    shellFailureStatus: "degraded",
    shellCaptureOutput: "stderr",
  });

  assert.equal(payload.templateRef, null);
  assert.equal(payload.configuration.failureStatus, "degraded");
  assert.equal(payload.configuration.captureOutput, "stderr");
});

test("monitor validation rejects embedded credentials and incomplete templates", () => {
  assert.throws(
    () =>
      activeMonitorPayload({
        ...activeMonitorDraft(),
        name: "Unsafe",
        restUrl: "https://user:password@example.test/health",
      }),
    /não pode conter credenciais/u,
  );
  assert.throws(
    () =>
      activeMonitorPayload({
        ...activeMonitorDraft(),
        name: "Missing template version",
        restUrl: "https://example.test/health",
        templateId: "health-v1",
      }),
    /identificador e a versão/u,
  );
});

test("monitoring instructions use the real workspace and runtime path", () => {
  const command = monitoringCliExample({
    runtimeReference: "biaws.api.production.primary",
    workspaceId: "workspace-biaws",
  });

  assert.match(command, /monitoring signal biaws\.api\.production\.primary/u);
  assert.match(command, /--workspace workspace-biaws/u);
  assert.doesNotMatch(command, /api-key|Bearer/u);
});

test("manual observations start with local time and origins stay distinguishable", () => {
  const draft = newObservationDraft(new Date("2026-08-13T15:45:00.000Z"));
  assert.match(draft.observedAt, /^2026-08-13T/u);
  assert.equal(monitoringOriginLabel("active"), "Ativo");
  assert.equal(monitoringOriginLabel("passive"), "Passivo");
  assert.equal(monitoringOriginLabel("manual"), "Manual");
});

test("monitoring history pages are merged without duplicate observations", () => {
  const events = mergeMonitoringEvents(
    [
      { id: "event-2", observedAt: "2026-08-13T12:00:00.000Z" },
      { id: "event-1", observedAt: "2026-08-13T11:00:00.000Z" },
    ],
    [
      { id: "event-1", observedAt: "2026-08-13T11:00:00.000Z" },
      { id: "event-3", observedAt: "2026-08-13T10:00:00.000Z" },
    ],
  );

  assert.deepEqual(
    events.map(({ id }) => id),
    ["event-2", "event-1", "event-3"],
  );
});

test("monitoring date-time filters are sent as unambiguous ISO instants", () => {
  const result = monitoringFilterParams({
    observedFrom: "2026-08-19T10:15",
    observedTo: "2026-08-19T12:45",
    status: "degraded",
  });

  assert.equal(result.observedFrom, new Date("2026-08-19T10:15").toISOString());
  assert.equal(result.observedTo, new Date("2026-08-19T12:45").toISOString());
  assert.equal(result.status, "degraded");
});

test("template selectors expose active versions and preserve the current reference", () => {
  const templates = selectableMonitoringTemplates(
    [
      {
        id: "health",
        name: "Health",
        versions: [
          { status: "inactive", version: "1" },
          { status: "active", version: "2" },
        ],
      },
      {
        id: "draft-only",
        name: "Draft only",
        versions: [{ status: "draft", version: "1" }],
      },
    ],
    { id: "health", version: "1" },
  );

  assert.deepEqual(
    templates.map(({ id }) => id),
    ["health"],
  );
  assert.deepEqual(
    templates[0].versions.map(({ version }) => version),
    ["1", "2"],
  );
});
