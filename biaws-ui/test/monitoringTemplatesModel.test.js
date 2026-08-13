import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PREVIEW_SAMPLE,
  monitoringTemplateDraft,
  monitoringTemplatePayload,
  monitoringTemplatePreviewPayload,
  templateStatusLabel,
} from "../src/components/settings/MonitoringTemplatesView/model.js";

test("monitoring template drafts expose the unified JSONata contract", () => {
  const draft = monitoringTemplateDraft({
    id: "template-1",
    name: "REST health",
    description: "Avalia o status HTTP",
    definition: {
      schemaVersion: "1",
      input: { mediaType: "application/json", sample: { up: true } },
      transformation: {
        language: "jsonata",
        expression: '{"status":"healthy","metadata":{}}',
      },
      output: {
        status: { type: "string", required: true, enum: ["healthy"] },
        message: { type: "string", required: false, maxLength: 2000 },
        metadata: {
          type: "object",
          required: true,
          additionalProperties: false,
          fields: [],
        },
      },
      presentation: { label: "Saúde", fields: [], series: [] },
    },
  });
  assert.equal(draft.id, "template-1");
  const definition = monitoringTemplatePayload(draft).definition;
  assert.equal(definition.schemaVersion, "1");
  assert.deepEqual(definition.input.sample, { up: true });
  assert.match(definition.transformation.expression, /healthy/u);
});

test("monitoring template preview parses a sanitized JSON sample", () => {
  const draft = monitoringTemplateDraft();
  const payload = monitoringTemplatePreviewPayload(
    draft,
    JSON.stringify(DEFAULT_PREVIEW_SAMPLE),
  );
  assert.equal(payload.sample.statusCode, 200);
  assert.throws(
    () => monitoringTemplatePreviewPayload(draft, "not-json"),
    /A amostra contém JSON inválido/u,
  );
  assert.equal(templateStatusLabel("active"), "Ativo");
});
