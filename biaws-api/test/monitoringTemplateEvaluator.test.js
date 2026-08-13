import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateMonitoringTemplate,
  normalizeMonitoringTemplateDefinition,
  sanitizeMonitoringTemplateSample,
} from "../src/repositories/monitoringTemplateEvaluator.js";

const definition = {
  rules: [
    {
      label: "REST saudável",
      match: "all",
      conditions: [
        { path: "evidence.status_code", operator: "equals", value: 200 },
        { path: "metadata.duration_ms", operator: "less_than", value: 500 },
      ],
      result: {
        status: "healthy",
        message: "HTTP {{evidence.status_code}} em {{metadata.duration_ms}}ms",
        metadata: { evaluated_by: "template" },
      },
    },
  ],
  defaultResult: {
    status: "degraded",
    message: "Resposta fora do esperado",
    metadata: {},
  },
};

test("monitoring templates evaluate declarative conditions and interpolate safe fields", () => {
  const preview = evaluateMonitoringTemplate(definition, {
    context: { provider: "rest" },
    evidence: { status_code: 200 },
    metadata: { duration_ms: 35 },
  });
  assert.equal(preview.result.status, "healthy");
  assert.equal(preview.result.message, "HTTP 200 em 35ms");
  assert.deepEqual(preview.result.metadata, { evaluated_by: "template" });
  assert.deepEqual(preview.matchedRule, { label: "REST saudável", index: 0 });
  assert.equal(
    preview.diagnostics[0].conditions.every(({ matched }) => matched),
    true,
  );
});

test("monitoring templates use the default result when no rule matches", () => {
  const preview = evaluateMonitoringTemplate(definition, {
    evidence: { status_code: 503 },
    metadata: { duration_ms: 900 },
    context: {},
  });
  assert.equal(preview.result.status, "degraded");
  assert.equal(preview.matchedRule, null);
});

test("monitoring templates reject invalid expressions and sensitive samples before activation", () => {
  assert.throws(
    () =>
      normalizeMonitoringTemplateDefinition({
        ...definition,
        rules: [
          {
            ...definition.rules[0],
            conditions: [
              { path: "evidence.status_code", operator: "matches", value: "[" },
            ],
          },
        ],
      }),
    (error) => error.statusCode === 422,
  );
  assert.throws(
    () =>
      sanitizeMonitoringTemplateSample({ evidence: { apiToken: "sensitive" } }),
    (error) => error.code === "INVALID_MONITORING_TEMPLATE",
  );
});
