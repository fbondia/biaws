import { errorCode } from "../../src/helpers/error.js";
import assert from "node:assert/strict";
import test from "node:test";

import { evaluateJsonataIsolated } from "../../src/repositories/monitoring/templates/jsonataEvaluator.js";
import { evaluateUnifiedMonitoringTemplate } from "../../src/repositories/monitoring/templates/unifiedEvaluator.js";
import { normalizeMonitoringTemplateDefinition } from "../../src/repositories/monitoring/templates/legacyEvaluator.js";
import { isRecord } from "../../src/helpers/records.js";

function definition(expression: string) {
  return {
    schemaVersion: "1",
    input: {
      mediaType: "application/json",
      sample: {
        values: [10, 20],
        dates: ["2026-08-12", "2026-08-13"],
      } as Record<string, unknown>,
    },
    transformation: { language: "jsonata", expression },
    output: {
      status: {
        type: "string",
        required: true,
        enum: ["healthy", "degraded", "unknown"],
      },
      message: { type: "string", required: true, maxLength: 100 },
      metadata: {
        type: "object",
        required: true,
        additionalProperties: false,
        fields: [
          { key: "average", type: "number", required: true, minimum: 0 },
          { key: "dates", type: "array", items: "string", maxItems: 10 },
          { key: "values", type: "array", items: "number", maxItems: 10 },
          { key: "unit", type: "string", enum: ["ms"] },
        ] as Array<{
          key: string;
          type: string;
          required?: boolean;
          minimum?: number;
          items?: string;
          maxItems?: number;
          enum?: string[];
        }>,
      },
    },
    presentation: {
      label: "Latency",
      fields: [
        {
          key: "average",
          label: "Average",
          format: "number",
          visualization: "value",
        },
      ],
      series: [
        {
          label: "History",
          visualization: "line",
          xKey: "dates",
          xFormat: "date",
          yKey: "values",
          yFormatKey: "unit",
        },
      ],
    },
  };
}

test("JSONata evaluates calculations and aligned series in an isolated worker", async () => {
  const evaluated = await evaluateUnifiedMonitoringTemplate(
    definition(
      '{"status": $average(values) < 20 ? "healthy" : "degraded", "message": "calculated", "metadata": {"average": $average(values), "dates": dates, "values": values, "unit": "ms"}}',
    ),
    { values: [10, 20], dates: ["2026-08-12", "2026-08-13"] },
  );
  assert.deepEqual(evaluated.result, {
    status: "healthy",
    message: "calculated",
    metadata: {
      average: 15,
      dates: ["2026-08-12", "2026-08-13"],
      values: [10, 20],
      unit: "ms",
    },
  });
});

test("JSONata diagnostics are sanitized and invalid output contracts are rejected", async () => {
  await assert.rejects(
    evaluateUnifiedMonitoringTemplate(definition("not valid ["), {}),
    (error) => {
      assert.equal(errorCode(error), "MONITORING_TEMPLATE_EVALUATION_FAILED");
      assert.ok(
        error instanceof Error &&
          isRecord(error) &&
          isRecord(error.publicDetails) &&
          isRecord(error.publicDetails.diagnostic),
      );
      assert.deepEqual(Object.keys(error.publicDetails.diagnostic).sort(), [
        "code",
        "phase",
        "position",
      ]);
      assert.doesNotMatch(error.stack || "", /node_modules[\\/]jsonata[\\/]/u);
      return true;
    },
  );
  await assert.rejects(
    evaluateUnifiedMonitoringTemplate(
      definition(
        '{"status": "healthy", "message": "bad", "metadata": {"average": -1, "dates": ["one"], "values": [1, 2], "unit": "ms"}}',
      ),
      {},
    ),
    { code: "INVALID_MONITORING_TEMPLATE_RESULT" },
  );
  const additionalPropertiesDefinition = definition(
    '{"status": "healthy", "message": "bad", "metadata": {"average": 1, "api_token": "unsafe"}}',
  );
  additionalPropertiesDefinition.output.metadata.additionalProperties = true;
  additionalPropertiesDefinition.presentation = {
    label: "Safe",
    fields: [],
    series: [],
  };
  await assert.rejects(
    evaluateUnifiedMonitoringTemplate(additionalPropertiesDefinition, {}),
    { code: "INVALID_MONITORING_TEMPLATE_RESULT" },
  );
});

test("JSONata workers enforce cancellation and timeout", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    evaluateJsonataIsolated("1 + 1", {}, { signal: controller.signal }),
    {
      code: "MONITORING_TEMPLATE_EVALUATION_CANCELLED",
    },
  );
  await assert.rejects(evaluateJsonataIsolated("1 + 1", {}, { timeoutMs: 1 }), {
    code: "MONITORING_TEMPLATE_EVALUATION_TIMEOUT",
  });
});

test("unified definitions reject custom functions and dynamic evaluation", () => {
  for (const expression of ["function($value) { $value }", '$eval("1 + 1")']) {
    assert.throws(
      () => normalizeMonitoringTemplateDefinition(definition(expression)),
      {
        code: "INVALID_MONITORING_TEMPLATE",
      },
    );
  }
});

test("unified definitions accept date-indexed JSON input but keep metadata keys strict", () => {
  const dateIndexed = definition(
    '{"status": "healthy", "message": "ok", "metadata": {"average": 1}}',
  );
  dateIndexed.input.sample = { dailyCounts: { "2026-08-12": 4 } };
  assert.doesNotThrow(() => normalizeMonitoringTemplateDefinition(dateIndexed));

  dateIndexed.output.metadata.fields.push({
    key: "2026-08-12",
    type: "number",
    required: false,
  });
  assert.throws(() => normalizeMonitoringTemplateDefinition(dateIndexed), {
    code: "INVALID_MONITORING_TEMPLATE",
  });
});
