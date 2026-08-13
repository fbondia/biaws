import assert from "node:assert/strict";
import test from "node:test";

import {
  activeMonitorDraft,
  activeMonitorPayload,
  monitoringCliExample,
  monitoringOriginLabel,
  newObservationDraft,
} from "../src/components/catalog/CatalogEntityDialog/runtimeMonitoringModel.js";

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
  });
  assert.equal(payload.templateRef, null);
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
